import { getEnvKey } from '../common/envkeys.mjs';
import { getSessionSections } from '../common/session-sections.mjs';

/**
 * Retrieve an indexed object that contains the list of sheets associated with
 * the event/project.
 */
export function getProjectSheets(spreadsheet) {
  // These are the sheets we expect to find in the spreadsheet
  const sheets = {
    grid: {},
    event: { titleMatch: /event/i },
    sessions: { titleMatch: /(list|breakouts)/i },
    meetings: { titleMatch: /meetings/i },
    rooms: { titleMatch: /rooms/i },
    days: { titleMatch: /days/i },
    slots: { titleMatch: /slots/i }
  };

  // Retrieve the sheets from the spreadsheet
  // (we'll consider that the grid view is the first sheet we find that isn't one of the
  // other well-known sheets. That gives some leeway as to how the sheet gets named.)
  for (const sheet of spreadsheet.getSheets()) {
    const name = sheet.getName().toLowerCase();
    const desc = Object.values(sheets).find(s => s.titleMatch?.test(name));
    if (desc) {
      desc.sheet = sheet;
      desc.values = getValues(sheet);
    }
    else if (!sheets.grid.sheet) {
      sheets.grid.sheet = sheet;
      sheets.grid.values = getValues(sheet);
    }
  }

  // Do we have all we need?
  if (!sheets.grid.sheet) {
    reportError('No "Grid view" sheet found, please add one and start again.');
    return;
  }
  if (!sheets.event.sheet) {
    reportError('No "Event" sheet found, please add one and start again.');
    return;
  }
  if (!sheets.rooms.sheet) {
    reportError('No "Rooms" sheet found, please import data from GitHub first.');
    return;
  }
  if (!sheets.days.sheet) {
    reportError('No "Days" sheet found, please import data from GitHub first.');
    return;
  }
  if (!sheets.slots.sheet) {
    reportError('No "Slots" sheet found, please import data from GitHub first.');
    return;
  }

  // The "Sessions" and "Meetings" sheets may be created afterwards, no error
  // to report if they do not exist.

  // No "Meetings" sheet for breakouts sessions? That's normal, there's a 1:1
  // relationship between breakout sessions and meetings, the sessions sheet
  // already contains the expanded view. 
  if (sheets.sessions.sheet && !sheets.meetings.sheet) {
    sheets.meetings.sheet = sheets.sessions.sheet;
    sheets.meetings.values = sheets.sessions.values;
  }

  return sheets;
}


/**
 * Load event/project metadata from the spreadsheet and return an object whose
 * structure matches the structure returned by the GitHub version of the code:
 *
 * {
 *   "title": "TPAC xxxx breakout sessions",
 *   "url": "https://github.com/organization/w3c/projects/xx",
 *   "id": "xxxxxxx",
 *   "roomsFieldId": "xxxxxxx",
 *   "rooms": [
 *     { "id": "xxxxxxx", "name": "Salon Ecija (30)", "label": "Salon Ecija", "capacity": 30 },
 *     ...
 *   ],
 *   "slotsFieldId": "xxxxxxx",
 *   "slots": [
 *     { "id": "xxxxxxx", "name": "9:30 - 10:30", "start": "9:30", "end": "10:30", "duration": 60 },
 *     ...
 *   ],
 *   "severityFieldIds": {
 *     "Check": "xxxxxxx",
 *     "Warning": "xxxxxxx",
 *     "Error": "xxxxxxx",
 *     "Note": "xxxxxxx"
 *   },
 *   "sessions": [
 *     {
 *       "repository": "w3c/tpacxxxx-breakouts",
 *       "number": xx,
 *       "title": "Session title",
 *       "body": "Session body, markdown",
 *       "labels": [ "session", ... ],
 *       "author": {
 *         "databaseId": 1122927,
 *         "login": "tidoust"
 *       },
 *       "room": "Salon Ecija (30)",
 *       "slot": "9:30 - 10:30"
 *     },
 *     ...
 *   ],
 *   "labels": [
 *     {
 *       "id": "xxxxxxx",
 *       "name": "error: format"
 *     },
 *     ...
 *   ]
 * }
 */
export function getProject(spreadsheet) {
  const sheets = getProjectSheets(spreadsheet);
  const metadata = sheets.event.values;

  function getSetting(name, defaultValue = null) {
    const value = metadata.find(v => v.parameter === name)?.value;
    return !!value ? value : defaultValue;
  }

  // Parse YAML GitHub issue template if it exists
  let sessionTemplate = null;
  let sessionSections = [];
  const sessionTemplateKey = spreadsheet.getDeveloperMetadata()
    .find(data => data.getKey() === 'session-template');
  if (sessionTemplateKey) {
    sessionTemplate = JSON.parse(sessionTemplateKey.getValue());
    sessionSections = getSessionSections(sessionTemplate);
  }

  const eventType = getSetting('Type', 'TPAC breakouts');
  let projectType;
  if (eventType === 'TPAC group meetings') {
    projectType = 'groups';
  }
  else if (eventType === 'TPAC breakouts') {
    projectType = 'tpac-breakouts';
  }
  else {
    projectType = 'breakouts-day';
  }
  const project = {
    title: spreadsheet.getName(),
    metadata: {
      type: projectType,
      timezone: getSetting('Timezone', 'Etc/UTC'),
      calendar: getSetting('Sync with W3C calendar', 'no'),
      rooms: getSetting('Show rooms in calendar') === 'no' ? 'hide' : 'show',
      meeting: getSetting('Meeting name in calendar', ''),
      reponame: getSetting('GitHub repository name')
    },

    rooms: sheets.rooms.values
      .filter(v => !!v.name)
      .map(v => {
        if (v['vip room']) {
          v.vip = v['vip room'] === 'yes' ? true : false;
          delete v['vip room'];
        }
        return v;
      }),

    days: sheets.days.values
      .filter(v => !!v.date)
      .map(v => {
        const name = v.weekday ?
          v.weekday + ' (' + v.date + ')' :
          v.date;
        return {
          id: v.id,
          name,
          label: !!v.weekday ? v.weekday : v.date,
          date: v.date
        };
      }),

    slots: sheets.slots.values
      .filter(v => !!v['start time'] && !!v['end time'])
      .map(v => {
        const name = v['start time'] + ' - ' + v['end time'];
        const times =
          name.match(/^(\d+):(\d+)\s*-\s*(\d+):(\d+)$/) ??
          [null, '00', '00', '01', '00'];
        return {
          id: v.id,
          start: v['start time'],
          end: v['end time'],
          name,
          duration:
            (parseInt(times[3], 10) * 60 + parseInt(times[4], 10)) -
            (parseInt(times[1], 10) * 60 + parseInt(times[2], 10))
        };
      }),

    allowMultipleMeetings: getSetting('Type') === 'group',
    allowTryMeOut: false,
    allowRegistrants: false,

    sessionTemplate,
    sessionSections,

    // TODO: how to retrieve the labels?
    labels: [],

    // TODO: initialize from sessions sheet if it exists
    // TODO: complete with meetings sheet if it exists
    sessions: []
  };

  return project;
}


/**
 * Return the values in a sheet as a list of objects whose property names are
 * derived from the header row.
 */
function getValues(sheet) {
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const values = rows.slice(1).map(row => {
    const value = {};
    for (let i = 0; i < headers.length; i++) {
      let content = row[i];
      if (typeof row[i] === 'string') {
        content = content.trim();
      }
      else if (row[i] instanceof Date) {
        const year = row[i].getFullYear();
        const month = row[i].getMonth() + 1;
        const day = row[i].getDate();
        content = '' + year + '-' +
          (month < 10 ? '0' : '') + month + '-' +
          (day < 10 ? '0' : '') + day;
      }
      if (content === '') {
        content = null;
      }
      value[headers[i].toLowerCase()] = content;
    }
    return value;
  });
  return values;
}


/**
 * Update the values in a sheet from a list of objects whose property names are
 * derived from the header row.
 */
function setValues(sheet, values) {
  const nbRows = sheet.getLastRow() - 1;
  const nbColumns = sheet.getLastColumn();
  console.log('rows cols', nbRows, nbColumns);

  const headers = sheet
    .getRange(1, 1, 1, nbColumns)
    .getValues()[0]
    .map(value => value.toLowerCase())
    .map(value => {
      // Some headers get mapped to a shorter name
      if (value === 'start time') {
        return 'start';
      }
      if (value === 'end time') {
        return 'end';
      }
      if (value === 'vip room') {
        return 'vip';
      }
      return value;
    });
  console.log('headers', headers);

  // Values is an array of indexed objects, while we need a two-dimensional
  // array of raw values. Let's convert the values.
  const rawValues = values.map((obj, vidx) => headers.map(header => {
    if (!obj.hasOwnProperty(header)) {
      return '';
    }
    if (obj[header] === true) {
      return 'yes';
    }
    if (obj[header] === false) {
      return 'no';
    }
    if (obj[header] === null) {
      return '';
    }
    if (header === 'author' && obj[header].login) {
      return obj[header].login;
    }
    return obj[header];
  }));
  console.log('raw values', rawValues);

  // Note: we may have more or less rows than in the current sheet
  if (nbRows > 0) {
    const updateNb = Math.min(nbRows, rawValues.length);
    const updateRange = sheet.getRange(
      2, 1, updateNb, nbColumns
    );
    updateRange.setValues(rawValues.slice(0, updateNb));
    if (nbRows > rawValues.length) {
      const clearRange = sheet.getRange(
        rawValues.length + 2, 1,
        nbRows - rawValues.length, nbColumns
      );
      clearRange.clear();
    }
  }
  if (nbRows < rawValues.length) {
    const appendRange = sheet.getRange(
      nbRows + 2, 1,
      rawValues.length - nbRows, nbColumns);
    appendRange.setValues(rawValues.slice(nbRows));
  }
}

/**
 * Refresh the project's data in the spreadsheet with information from GitHub
 */
export function refreshProject(spreadsheet, project, { what }) {
  const sheets = getProjectSheets(spreadsheet);

  function setSetting(name, value) {
    const metadataRows = sheets.event.sheet.getDataRange().getValues();
    const rowIdx = metadataRows.findIndex(row => row[0] === name);
    let cell;
    if (rowIdx === -1) {
      const lastRow = metadataRows.getLastRow();
      cell = sheets.event.sheet.getRange(lastRow + 1, 1);
      cell.setValue(name);
      cell = sheets.event.sheet.getRange(lastRow + 1, 2);
      cell.setValue(value);
    }
    else {
      cell = sheets.event.sheet.getRange(rowIdx + 1, 2);
      cell.setValue(value);
    }
  }

  function refreshData(type) {
    // The column that contains the identifier on which to match values
    // depends on the type of data being updated.
    let idKey = 'id';
    if (type === 'rooms') {
      idKey = 'name';
    }
    else if (type === 'days') {
      idKey = 'date';
    }
    else if (type === 'slots') {
      idKey = 'start';
    }
    else if (type === 'sessions') {
      idKey = 'number';
    }
    console.log(type, idKey);
    const values = sheets[type].values ?? [];
    const seen = [];
    for (const obj of project[type]) {
      const value = values.find(val => val[idKey] === obj[idKey]);
      if (value) {
        // Existing item, refresh the data
        for (const [key, val] of Object.entries(obj)) {
          value[key] = val;
        }
        seen.push(value);
      }
      else {
        // New item, add to the end of the list
        values.push(obj);
        seen.push(obj);
      }
    }
    const toset = values.filter(value => seen.includes(value));
    console.log(type, toset.length);
    setValues(sheets[type].sheet, toset);

    // Set formula to auto-fill the weekday in the days sheet
    // and the slot name in the slots sheet
    // TODO: this assumes a position for the columns
    if (type === 'days') {
      const range = sheets[type].sheet.getRange('B2:B');
      range.setFormulaR1C1(
        '=IF(INDIRECT("R[0]C[-1]", false) <> "", CHOOSE(WEEKDAY(INDIRECT("R[0]C[-1]", false)), "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ), "")'
      );
    }
    if (type === 'slots') {
      const range = sheets[type].sheet.getRange('C2:C');
      range.setFormulaR1C1(
        '=IF(INDIRECT("R[0]C[-2]", false) <> "", CONCAT(CONCAT(INDIRECT("R[0]C[-2]", false), "-"), INDIRECT("R[0]C[-1]", false)), "")'
      );
    }

    // To make team's life easier, we'll convert session numbers in the first
    // column to a link to the session on GitHub
    if (type === 'sessions' && toset.length > 0) {
      const richValues = toset
        .map(session => SpreadsheetApp
          .newRichTextValue()
          .setText(session.number)
          .setLinkUrl(`https://github.com/${session.repository}/issues/${session.number}`)
          .build()
        )
        .map(richValue => [richValue]);
      const range = sheets[type].sheet.getRange(2, 1, toset.length, 1);
      range.setRichTextValues(richValues);
    }

    SpreadsheetApp.flush();
  }

  // Refresh metadata settings
  if (what === 'all' || what === 'metadata') {
    // Refresh the session template
    const sessionTemplate = spreadsheet.getDeveloperMetadata()
      .find(data => data.getKey() === 'session-template');
    const value = JSON.stringify(project.sessionTemplate, null, 2)
    if (sessionTemplate) {
      sessionTemplate.setValue(value);
    }
    else {
      spreadsheet.addDeveloperMetadata('session-template', value);
    }

    // TODO: Refresh the list of labels

    for (const [name, value] of Object.entries(project.metadata)) {
      if (name === 'type') {
        // TODO: Refresh event type? There's one more type in the spreadsheet
      }
      else if (name === 'rooms') {
        setSetting('Show rooms in calendar', !!value ? 'yes' : 'no');
      }
      else if (name === 'calendar') {
        setSetting('Sync with W3C calendar', value);
      }
      else if (name === 'timezone') {
        setSetting('Timezone', value);
      }
      else if (name === 'meeting') {
        setSetting('Meeting name in calendar', value);
      }
      else {
        setSetting(name, value);
      }
    }
    SpreadsheetApp.flush();

    // Refresh rooms, days, slots
    for (const type of ['rooms', 'days', 'slots']) {
      refreshData(type);
    }
  }

  // Refresh sessions
  if (what === 'all' || what === 'sessions') {
    if (!sheets.sessions.sheet) {
      sheets.sessions.sheet = createSessionsSheet(spreadsheet, sheets, project);
    }
    refreshData('sessions');
  }

  // TODO: refresh meetings (only for TPAC events)
}

function createSessionsSheet(spreadsheet, sheets, project) {
  // Create the new sheet
  const title = project.metadata.type === 'groups' ? 'List' : 'Breakouts';
  const sheet = spreadsheet.insertSheet(title, spreadsheet.getSheets().length - 2);

  // Set the headers row
  const headers = [
    'Number', 'Title', 'Author', 'Body', 'Labels',
    'Room', 'Day', 'Slot', 'Meeting',
    'Error', 'Warning', 'Check', 'Note',
    'Registrants'
  ];
  const headersRow = sheet.getRange(1, 1, 1, headers.length);
  headersRow.setValues([headers]);
  headersRow.setFontWeight('bold');
  sheet.setFrozenRows(1);
  headersRow
    .protect()
    .setDescription(`${title} - headers`)
    .setWarningOnly(true);

  sheet.setRowHeightsForced(2, sheet.getMaxRows() - 1, 60);
  sheet.setColumnWidths(headers.findIndex(h => h === 'Number') + 1, 1, 60);
  sheet.setColumnWidths(headers.findIndex(h => h === 'Title') + 1, 1, 300);
  sheet.setColumnWidths(headers.findIndex(h => h === 'Body') + 1, 1, 300);
  sheet.setColumnWidths(headers.findIndex(h => h === 'Room') + 1, 1, 150);
  sheet.setColumnWidths(headers.findIndex(h => h === 'Day') + 1, 1, 150);

  // TODO: this assumes that room name is in column "A".
  const roomValuesRange = sheets.rooms.sheet.getRange('A2:A');
  const roomRule = SpreadsheetApp
    .newDataValidation()
    .requireValueInRange(roomValuesRange)
    .setAllowInvalid(false)
    .build();
  const roomRange = sheet.getRange(
    2, headers.findIndex(h => h === 'Room') + 1,
    sheet.getMaxRows() - 1, 1);
  roomRange.setDataValidation(roomRule);

  // TODO: this assumes that day name is in column "A".
  const dayValuesRange = sheets.days.sheet.getRange('A2:A');
  const dayRule = SpreadsheetApp
    .newDataValidation()
    .requireValueInRange(dayValuesRange)
    .setAllowInvalid(false)
    .build();
  const dayRange = sheet.getRange(
    2, headers.findIndex(h => h === 'Day') + 1,
    sheet.getMaxRows() - 1, 1);
  dayRange.setDataValidation(dayRule);

  // TODO: this assumes that slot name is in column "C".
  const slotValuesRange = sheets.slots.sheet.getRange('C2:C');
  const slotRule = SpreadsheetApp
    .newDataValidation()
    .requireValueInRange(slotValuesRange)
    .setAllowInvalid(false)
    .build();
  const slotRange = sheet.getRange(
    2, headers.findIndex(h => h === 'Slot') + 1,
    sheet.getMaxRows() - 1, 1);
  slotRange.setDataValidation(slotRule);

  sheet
    .getRange(2, 1,
      sheet.getMaxRows() - 1,
      headers.findIndex(h => h === 'Labels') + 1)
    .protect()
    .setDescription(`${title} - content from GitHub`)
    .setWarningOnly(true);

  return sheet;
}