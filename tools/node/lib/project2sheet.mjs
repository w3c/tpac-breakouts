import { convertProjectToJSON } from '../../common/project.mjs';
import { parseSessionMeetings } from '../../common/meetings.mjs';
import { google } from 'googleapis';

/**
 * Convert the project to a Google Sheet
 */
export async function convertProjectToSheet(project,
    { spreadsheetId, driveId, keyFile, editorEmail } ) {
  // Authenticate through a service token
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
  const authClient = await auth.getClient();

  const sheets = google.sheets({
    version: 'v4',
    auth: authClient
  });

  /**
   * Inner function to create the spreadsheet if it does not exist yet
   */
  async function createSpreadsheet() {
    const now = new Date();
    const nowPrefix = now.toISOString()
      .substring(0, 'YYYY-MM-DDTHH:mm:ss'.length)
      .replace(/[-:]/g, '');
    let res = await sheets.spreadsheets.create({
      resource: {
        properties: {
          title: nowPrefix + ' - '+ project.title
        },
        sheets: [
          { properties: { title: 'Grid view' } }
        ].concat(Object.values(sheetsInfo).map(info =>
          Object.assign({ properties: { title: info.title } })
        ))
      },
      fields: 'spreadsheetId,spreadsheetUrl',
    });
    const fileId = res.data.spreadsheetId;
    console.warn(`- created new Google spreadsheet: ${res.data.spreadsheetUrl}`);

    // Move sheet to shared folder
    const drive = google.drive({
      version: 'v3',
      auth: authClient
    });
    if (driveId) {
      res = await drive.files.get({
        fileId,
        fields: 'parents'
      });
      const rootFolderId = res.data.parents[0];
      res = await drive.files.update({
        fileId,
        addParents: driveId,
        removeParents: rootFolderId,
        supportsAllDrives: true,
        fields: 'parents'
      });
      if (res.data.parents[0] !== driveId) {
        throw new Error('Could not move the spreadsheet to the provided shared drive. Check ID and permissions.');
      }
      console.warn(`- moved spreadsheet to shared drive: ${driveId}`);
    }
    else if (editorEmail) {
      // Note: cannot transfer ownership because service account is not
      // seen as being part of an organization by Google
      res = await drive.permissions.create({
        fileId,
        resource: {
          type: 'user',
          role: 'editor',
          emailAddress: editorEmail
        }
      });
      console.warn(`- gave editor rights to: ${editorEmail}`);
    }

    return fileId;
  }

  // Information about the sheets within the spreadsheet
  const sheetsInfo = {
    sessions: {
      titleMatch: /list/i,
      title: 'List view'
    },
    meetings: {
      titleMatch: /meetings/i,
      title: 'Meetings',
      specificTo: 'groups'
    },
    rooms: {
      titleMatch: /rooms/i,
      title: 'Rooms'
    },
    days: {
      titleMatch: /days/i,
      title: 'Days'
    },
    slots: {
      titleMatch: /slots/i,
      title: 'Slots'
    }
  };

  /**
   * Inner function to retrieve/create the appropriate sheets in the
   * spreadsheet.
   *
   * The code needs the spreadsheet to contain the sheets listed in
   * sheetsInfo, plus a first sheet with the grid view (the code does not
   * enforce that though).
   */
  async function getOrCreateSheets(spreadsheetId) {
    const res = await sheets.spreadsheets.get({ spreadsheetId });

    function getSheet(data, name) {
      return data?.find(sheet => sheet.properties.title.match(sheetsInfo[name].titleMatch));
    }

    const requests = Object.entries(sheetsInfo)
      .filter(([name, desc]) => !desc.specificTo ||
        project.metadata.type === desc.specificTo)
      .filter(([name, desc]) => !getSheet(res.data.sheets, name))
      .map(([name, desc]) => Object.assign({
        addSheet: {
          properties: {
            title: sheetsInfo[name].title
          }
        }
      }));
    let updated;
    if (requests.length > 0) {
      updated = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests },
        includeSpreadsheetInResponse: true
      });
      console.warn(`- created missing sheets within the spreadsheet`);
    }

    for (const [name, desc] of Object.entries(sheetsInfo)) {
      const sheet =
        getSheet(res.data.sheets, name) ??
        getSheet(updated?.data?.updatedSpreadsheet?.sheets, name);
      if (sheet) {
        desc.sheetId = sheet.properties.sheetId;
        desc.title = sheet.properties.title;
      }
      if (name === 'sessions') {
        const devMetadata = res.data.developerMetadata?.find(d =>
          d.metadataKey === 'session-template');
        if (devMetadata) {
          desc.sessionTemplate = devMetadata.metadataValue;
        }
      }
    }
  }

  /**
   * Convert the provided value and optional cell format into the appropriate
   * structure for the Google Sheets API
   */
  function makeCell(value, format) {
    return {
      userEnteredValue: typeof(value) === 'number' ?
        Object.assign({ numberValue: value }) :
        Object.assign({ stringValue: value }),
      userEnteredFormat: Object.assign({
        verticalAlignment: 'TOP'
      }, format)
    };
  }

  function getFreezeRequest(sheetId) {
    return {
      updateSheetProperties: {
        fields: 'gridProperties.frozenRowCount',
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 }
        }
      }
    };
  }

  function getUpdateDimensionRequest(sheetId,
      { dimension, startIndex, endIndex, pixelSize }) {
    const range = endIndex ?
      { sheetId, dimension, startIndex, endIndex } :
      { sheetId, dimension, startIndex };
    return {
      updateDimensionProperties: {
        range,
        fields: 'pixelSize',
        properties: { pixelSize }
      }
    };
  }

  function getColRangeValidationRequest(sheetId,
      { startIndex, endIndex, range }) {
    return {
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: startIndex,
          endColumnIndex: endIndex
        },
        rule: {
          condition: {
            type: 'ONE_OF_RANGE',
            values: [
              { userEnteredValue: range }
            ]
          },
          strict: true,
          showCustomUi: true
        }
      }
    }
  }

  /**
   * Update the list of rooms
   */
  async function updateRooms() {
    const sheetId = sheetsInfo.rooms.sheetId;
    let res = await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: sheetsInfo.rooms.title
    });

    res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          // Fill out the headers' row
          {
            updateCells: {
              start: { sheetId, rowIndex: 0, columnIndex: 0 },
              fields: 'userEnteredValue',
              rows: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'ID' } },
                    { userEnteredValue: { stringValue: 'Name' } },
                    { userEnteredValue: { stringValue: 'Label' } },
                    { userEnteredValue: { stringValue: 'Location' } },
                    { userEnteredValue: { stringValue: 'Capacity' } }
                  ]
                }
              ]
            }
          },

          // Freeze the headers' row
          getFreezeRequest(sheetId),

          // Fill out the rest of the table (second row at index 1)
          {
            updateCells: {
              start: { sheetId, rowIndex: 1, columnIndex: 0 },
              fields: 'userEnteredValue,userEnteredFormat',
              rows: project.rooms.map(room => {
                const values = [
                  makeCell(room.id),
                  makeCell(room.name),
                  makeCell(room.label),
                  makeCell(room.location),
                  makeCell(room.capacity)
                ];
                return { values };
              })
            }
          },

          // Shrink width of first column with issue number
          getUpdateDimensionRequest(sheetId, {
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 1,
            pixelSize: 80
          }),

          // Enlarge width of second, third and fourth column
          getUpdateDimensionRequest(sheetId, {
            dimension: 'COLUMNS',
            startIndex: 1,
            endIndex: 4,
            pixelSize: 150
          }),

          // Shrink width of fifth column
          getUpdateDimensionRequest(sheetId, {
            dimension: 'COLUMNS',
            startIndex: 4,
            endIndex: 5,
            pixelSize: 60
          })
        ]
      }
    });
  }

  /**
   * Update the list of days
   */
  async function updateDays() {
    const sheetId = sheetsInfo.days.sheetId;
    let res = await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: sheetsInfo.days.title
    });

    res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          // Fill out the headers' row
          {
            updateCells: {
              start: { sheetId, rowIndex: 0, columnIndex: 0 },
              fields: 'userEnteredValue',
              rows: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'ID' } },
                    { userEnteredValue: { stringValue: 'Name' } },
                    { userEnteredValue: { stringValue: 'Label' } },
                    { userEnteredValue: { stringValue: 'Date' } }
                  ]
                }
              ]
            }
          },

          // Freeze the headers' row
          getFreezeRequest(sheetId),

          // Fill out the rest of the table (second row at index 1)
          {
            updateCells: {
              start: { sheetId, rowIndex: 1, columnIndex: 0 },
              fields: 'userEnteredValue,userEnteredFormat',
              rows: project.days.map(day => {
                const values = [
                  makeCell(day.id),
                  makeCell(day.name),
                  makeCell(day.label),
                  makeCell(day.date)
                ];
                return { values };
              })
            }
          },

          // Shrink width of first column with issue number
          getUpdateDimensionRequest(sheetId, {
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 1,
            pixelSize: 80
          }),

          // Enlarge width of second and third column
          getUpdateDimensionRequest(sheetId, {
            dimension: 'COLUMNS',
            startIndex: 1,
            endIndex: 3,
            pixelSize: 150
          })
        ]
      }
    });
  }

  /**
   * Update the list of slots
   */
  async function updateSlots() {
    const sheetId = sheetsInfo.slots.sheetId;
    let res = await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: sheetsInfo.slots.title
    });

    res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          // Fill out the headers' row
          {
            updateCells: {
              start: { sheetId, rowIndex: 0, columnIndex: 0 },
              fields: 'userEnteredValue',
              rows: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'ID' } },
                    { userEnteredValue: { stringValue: 'Name' } },
                    { userEnteredValue: { stringValue: 'Start' } },
                    { userEnteredValue: { stringValue: 'End' } },
                    { userEnteredValue: { stringValue: 'Duration' } }
                  ]
                }
              ]
            }
          },

          // Freeze the headers' row
          getFreezeRequest(sheetId),

          // Fill out the rest of the table (second row at index 1)
          {
            updateCells: {
              start: { sheetId, rowIndex: 1, columnIndex: 0 },
              fields: 'userEnteredValue,userEnteredFormat',
              rows: project.slots.map(slot => {
                const values = [
                  makeCell(slot.id),
                  makeCell(slot.name),
                  makeCell(slot.start),
                  makeCell(slot.end),
                  makeCell(slot.duration)
                ];
                return { values };
              })
            }
          },

          // Shrink width of first column with issue number
          getUpdateDimensionRequest(sheetId, {
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 1,
            pixelSize: 80
          }),

          // Shrink width of fourth to sixth column
          getUpdateDimensionRequest(sheetId, {
            dimension: 'COLUMNS',
            startIndex: 3,
            endIndex: 6,
            pixelSize: 60
          })
        ]
      }
    });
  }

  /**
   * Update the list of sessions
   */
  async function updateSessions() {
    const sheetId = sheetsInfo.sessions.sheetId;
    let res = await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: sheetsInfo.sessions.title
    });

    // Prepare lists of unique values to set validation constraints
    const authors = [...new Set(project.sessions.map(s => s.author.login))];

    // Fill out the list view
    res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          // Reset data validation constraints
          {
            setDataValidation: {
              range: { sheetId }
            }
          },

          // Fill out the headers' row
          {
            updateCells: {
              start: { sheetId, rowIndex: 0, columnIndex: 0 },
              fields: 'userEnteredValue',
              rows: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'Number' } },
                    { userEnteredValue: { stringValue: 'Title' } },
                    { userEnteredValue: { stringValue: 'Author' } },
                    { userEnteredValue: { stringValue: 'Body' } },
                    { userEnteredValue: { stringValue: 'Labels' } },
                    { userEnteredValue: { stringValue: 'Room' } },
                    { userEnteredValue: { stringValue: 'Day' } },
                    { userEnteredValue: { stringValue: 'Slot' } },
                    { userEnteredValue: { stringValue: 'Meeting' } },
                    { userEnteredValue: { stringValue: 'Error' } },
                    { userEnteredValue: { stringValue: 'Warning' } },
                    { userEnteredValue: { stringValue: 'Check' } },
                    { userEnteredValue: { stringValue: 'Note' } },
                    { userEnteredValue: { stringValue: 'Registrants' } }
                  ]
                }
              ]
            }
          },

          // Freeze the headers' row
          getFreezeRequest(sheetId),

          // Fill out the rest of the table (second row at index 1)
          {
            updateCells: {
              start: { sheetId, rowIndex: 1, columnIndex: 0 },
              fields: 'userEnteredValue,userEnteredFormat',
              rows: project.sessions.map(session => {
                const values = [
                  makeCell(session.number, {
                    textFormat: {
                      link: {
                        uri: `https://github.com/${session.repository}/issues/${session.number}`
                      }
                    },
                    hyperlinkDisplayType: 'LINKED'
                  }),
                  makeCell(session.title, { wrapStrategy: 'WRAP' }),
                  makeCell(session.author.login),
                  makeCell(session.body, { wrapStrategy: 'WRAP' })
                ];
                const labels = session.labels.filter(label => label !== 'session');
                values.push(makeCell(labels.join(',') ?? ''));
                if (session.room) {
                  const room = project.rooms.find(v => v.name === session.room);
                  values.push(makeCell(room.label));
                }
                else {
                  values.push(makeCell(''));
                }
                if (session.day) {
                  const day = project.days.find(v => v.name === session.day);
                  values.push(makeCell(day.label));
                }
                else {
                  values.push(makeCell(''));
                }
                if (session.slot) {
                  const slot = project.slots.find(v => v.name === session.slot);
                  values.push(makeCell(slot.name));
                }
                else {
                  values.push(makeCell(''));
                }
                values.push(makeCell(
                  (session.meeting ?? '').split(/\s*;\s*/).join('\n')));
                for (const field of ['error', 'warning', 'check', 'note']) {
                  values.push(makeCell(session.validation[field] ?? ''));
                }
                values.push(makeCell(session.registrants ?? ''));
                return { values };
              })
            }
          },

          // Set data validation constraint on authors (third column at index 2)
          {
            setDataValidation: {
              range: {
                sheetId,
                startRowIndex: 1,
                startColumnIndex: 2,
                endColumnIndex: 3
              },
              rule: {
                condition: {
                  type: 'ONE_OF_LIST',
                  values: authors.map(author =>
                    Object.assign({ userEnteredValue: author }))
                },
                strict: true,
                showCustomUi: true
              }
            }
          },

          // Set data validation constraint on rooms (sixth column at index 5)
          getColRangeValidationRequest(sheetId, {
            startIndex: 5,
            endIndex: 6,
            range: `='${sheetsInfo.rooms.title}'!C2:C`
          }),

          // Set data validation constraint on days (seventh column at index 6)
          getColRangeValidationRequest(sheetId, {
            startIndex: 6,
            endIndex: 7,
            range: `='${sheetsInfo.days.title}'!C2:C`
          }),

          // Set data validation constraint on slots (eighth column at index 7)
          getColRangeValidationRequest(sheetId, {
            startIndex: 7,
            endIndex: 8,
            range: `='${sheetsInfo.slots.title}'!B2:B`
          }),

          // Set height of rows
          getUpdateDimensionRequest(sheetId, {
            dimension: 'ROWS',
            startIndex: 1,
            pixelSize: 60
          }),

          // Shrink width of first column with issue number
          getUpdateDimensionRequest(sheetId, {
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 1,
            pixelSize: 60
          }),
          
          // Enlarge title column
          getUpdateDimensionRequest(sheetId, {
            dimension: 'COLUMNS',
            startIndex: 1,
            endIndex: 2,
            pixelSize: 300
          }),
          
          // Enlarge issue body column
          getUpdateDimensionRequest(sheetId, {
            dimension: 'COLUMNS',
            startIndex: 3,
            endIndex: 4,
            pixelSize: 300
          }),
          
          // Enlarge room and day columns
          getUpdateDimensionRequest(sheetId, {
            dimension: 'COLUMNS',
            startIndex: 5,
            endIndex: 7,
            pixelSize: 150
          })
        ]
      }
    });
  }

  /**
   * The list of meetings provides an expanded view of the "Meeting" column
   * in the list of sessions
   */
  async function updateMeetings() {
    if (project.metadata.type !== 'groups') {
      return;
    }
    const sheetId = sheetsInfo.meetings.sheetId;

    let res = await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: sheetsInfo.meetings.title
    });

    res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          // Reset data validation constraints
          {
            setDataValidation: {
              range: { sheetId }
            }
          },

          // Fill out the headers' row
          {
            updateCells: {
              start: { sheetId, rowIndex: 0, columnIndex: 0 },
              fields: 'userEnteredValue',
              rows: [
                {
                  values: [
                    { userEnteredValue: { stringValue: 'Number' } },
                    { userEnteredValue: { stringValue: 'Day' } },
                    { userEnteredValue: { stringValue: 'Slot' } },
                    { userEnteredValue: { stringValue: 'Room' } }
                  ]
                }
              ]
            }
          },

          // Freeze the headers' row
          getFreezeRequest(sheetId),

          // Fill out the rest of the table (second row at index 1)
          {
            updateCells: {
              start: { sheetId, rowIndex: 1, columnIndex: 0 },
              fields: 'userEnteredValue,userEnteredFormat',
              rows: project.sessions
                .map(session =>
                  parseSessionMeetings(session, project).map(meeting =>
                    Object.assign({ number: session.number }, meeting)))
                .flat()
                .map(meeting => {
                  const values = [
                    makeCell(meeting.number)
                  ];
                  if (meeting.day) {
                    const day = project.days.find(v => v.name === meeting.day);
                    values.push(makeCell(day.label));
                  }
                  else {
                    values.push(makeCell(''));
                  }
                  if (meeting.slot) {
                    const slot = project.slots.find(v => v.name === meeting.slot);
                    values.push(makeCell(slot.name));
                  }
                  else {
                    values.push(makeCell(''));
                  }
                  if (meeting.room) {
                    const room = project.rooms.find(v => v.name === meeting.room);
                    values.push(makeCell(room.label));
                  }
                  else {
                    values.push(makeCell(''));
                  }
                  return { values };
                })
            }
          }
        ]
      }
    });
  }

  /**
   * The YAML session template is stored as developer metadata in the
   * spreadsheet.
   *
   * Note: the function assumes that no one else will mess up with developer
   * metadata (and, e.g., create another "session-template" key with a
   * different location)
   */
  async function updateSessionTemplate() {
    let request;
    if (sheetsInfo.sessions.sessionTemplate) {
      request = {
        updateDeveloperMetadata: {
          dataFilters: [
            {
              developerMetadataLookup: {
                metadataKey: 'session-template'
              }
            }
          ],
          developerMetadata: {
            metadataValue: project.sessionTemplate
          },
          fields: 'metadataValue'
        }
      };
    }
    else {
      request = {
        createDeveloperMetadata: {
          developerMetadata: {
            metadataKey: 'session-template',
            metadataValue: project.sessionTemplate,
            location: { spreadsheet: true },
            visibility: 'DOCUMENT'
          }
        }
      };
    }
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests: [request] }
    });
  }

  // Create the spreadsheet if needed
  if (!spreadsheetId) {
    spreadsheetId = await createSpreadsheet();
  }
  await getOrCreateSheets(spreadsheetId);

  // Fill out the spreadsheet
  await updateRooms();
  await updateDays();
  await updateSlots();
  await updateSessions();
  await updateMeetings();
  await updateSessionTemplate();

  /*const res = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: true
  });
  console.log(JSON.stringify(res.data, null, 2));*/
}