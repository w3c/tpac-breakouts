import { groupSessionMeetings } from '../../common/meetings.mjs';
import { Srand } from '../../common/jsrand.mjs';

/**
 * Fill the grid in the provided spreadsheet
 */
export function fillGridSheet(spreadsheet, project, validationErrors) {
  let gridVersion = Math.max(
    ...spreadsheet.getSheets()
      .map(sheet => sheet.getName())
      .filter(name => name.match(/^Schedule v(\d+)$/))
      .map(name => name.match(/^Schedule v(\d+)$/)[1])
      .map(nb => parseInt(nb))
  );
  if (gridVersion === -Infinity) {
    gridVersion = 0;
  }
  gridVersion += 1;

  const sheet = spreadsheet.insertSheet(
    'Schedule v' + gridVersion,
    spreadsheet.getSheets().length
  );
  console.log('- clear sheet');
  sheet.clear();
  console.log('- attach result as metadata');
  const metadata = project.sessions.map(session => [
    session.number,
    session.room,
    session.day,
    session.slot,
    session.meeting,
    session.labels
  ]);
  sheet.addDeveloperMetadata('SCHEDULE', JSON.stringify(metadata));
  console.log('- create headers row');
  createHeaderRow(sheet, project.rooms);
  console.log('- create days/slots headers');
  createDaySlotColumns(sheet, project.days, project.slots, validationErrors);
  console.log('- add sessions to the grid');
  addSessions(sheet, project, validationErrors);
  console.log('- add borders');
  addBorders(sheet, project);
  sheet
    .protect()
    .setDescription(`${sheet.getName()} - read-only view`)
    .setWarningOnly(true);
  fillGridValidationSheet(spreadsheet, project, gridVersion, validationErrors);
}

/**
 * Fill the grid validation sheet
 */
function fillGridValidationSheet(spreadsheet, project, gridVersion, validationErrors) {
  // TODO: consider reporting "check" messages as well
  validationErrors = validationErrors.filter(err => err.severity !== 'check');
  if (validationErrors.length === 0) {
    return;
  }

  const sheet = spreadsheet.insertSheet(
    `Schedule v${gridVersion} issues`,
    spreadsheet.getSheets().length
  );
  console.log('- clear grid validation sheet');
  sheet.clear();

  console.log('- create headers in grid validation sheet');
  const headers = ['Number', 'Title', 'Meetings', 'Errors', 'Warnings'];
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setValues([headers])
  sheet
    .autoResizeColumns(2, headers.length)
    .setFrozenRows(1);

  const values = [];
  const sessions = project.sessions.filter(s =>
    validationErrors.find(err => err.session === s.number));
  for (const session of sessions) {
    console.log(`- report grid validation errors for session ${session.number}`);
    const errors = validationErrors.filter(err =>
      err.session === session.number &&
      err.severity === 'error');
    const warnings = validationErrors.filter(err =>
      err.session === session.number &&
      err.severity === 'warning');
    values.push([
      session.number,
      session.title,
      getMeetingsDescription(session, project),
      getDescription(errors),
      getDescription(warnings)
    ]);
  }

  if (values.length > 0) {
    const range = sheet.getRange(2, 1, values.length, headers.length);
    range
      .setValues(values)
      .setVerticalAlignment('top');

    const sessionsSheetUrl = '#gid=' + project.sheets.sessions.sheet.getSheetId();
    const richValues = values
      .map(value => SpreadsheetApp
        .newRichTextValue()
        .setText(value[0])
        .setLinkUrl(`${sessionsSheetUrl}&range=A${project.sessions.findIndex(s => s.number === value[0]) + 2}`)
        .build())
      .map(richValue => [richValue]);
    const firstCol = sheet.getRange(2, 1, values.length, 1);
    firstCol.setRichTextValues(richValues);
  }

  SpreadsheetApp.flush();
  sheet.setColumnWidth(1, 60);
  sheet.setColumnWidth(2, 300);
  sheet.autoResizeColumns(3, 3);
}


/**
 * Get a description of the given list of errors or warnings suitable for
 * display.
 */
function getDescription(errors) {
  return errors
    .map(error => error.messages.map(msg => `[${error.type}] ${msg}`))
    .flat()
    .join('\n');
}


/**
 * Return a description of the session meeting(s)
 */
function getMeetingsDescription(session, project) {
  return groupSessionMeetings(session, project)
    .sort((m1, m2) => {
      const day1 = project.days.find(day => day.name === m1.meeting.day || day.date === m1.meeting.day);
      const day2 = project.days.find(day => day.name === m2.meeting.day || day.date === m2.meeting.day);
      if (day1.date < day2.date) {
        return -1;
      }
      else if (day1.date > day2.date) {
        return 1;
      }
      else if (m1.meeting.start < m2.meeting.start) {
        return -1;
      }
      else if (m1.meeting.start > m2.meeting.start) {
        return 1;
      }
      else {
        return 0;
      }
    })
    .map(meeting => {
      const day = project.days.find(day => day.name === meeting.day || day.date === meeting.day);
      const room = project.rooms.find(room => room.name === meeting.room);
      return `${day.label}, ${meeting.start} - ${meeting.end}` +
        (room ? ` in ${room.name}` : '');
    })
    .join('\n');
}


/**
 * Create the header row of the grid view with the list of rooms.
 */
function createHeaderRow(sheet, rooms) {
  const labels = rooms.map(room =>
    `${room.name}${room.location ? '\n' + room.location : ''}`);
  const values = [['Days', 'Slots'].concat(labels)];
  sheet.getRange(1, 1, values.length, values[0].length)
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center')
    .setBackground('#c27ba0')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setValues(values)
  sheet
    .setColumnWidths(3, rooms.length, 150)
    .setFrozenRows(1);
}


/**
 * Create the day/slot columns of the grid view
 */
function createDaySlotColumns(sheet, days, slots, validationErrors) {
  const startRow = 2; // Start after the header row
  const startCol = 1; // Start in first column

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    sheet.getRange(startRow + (i * slots.length), startCol, slots.length)
      .mergeVertically()
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('center')
      .setFontWeight('bold')
      .setBackground('#fce5cd')
      .setValue(day.label);
  }

  // Slots are repeated for all days
  const repeatedSlots = days
    .map(day => slots.map(slot => {
      slot = Object.assign({ errors: [] }, slot);
      for (const issue of validationErrors) {
        if (!issue.details) {
          continue;
        }
        if (issue.type !== 'chair conflict' &&
            issue.type !== 'group conflict' &&
            issue.type !== 'track') {
          continue;
        }
        for (const detail of issue.details) {
          const meeting = detail.meeting ?? detail;
          if (day.name !== meeting.day) {
            continue;
          }
          if (slot.name !== meeting.slot) {
            continue;
          }
          slot.errors.push({ issue, detail });
        }
      }
      return slot;
    }))
    .flat()
    .map(slot => {
      let label = slot.name;
      let backgroundColor = null;

      const trackConflicts = [... new Set(slot.errors
        .filter(error => error.issue.type === 'track')
        .map(error => error.detail.track))];
      if (trackConflicts.length > 0) {
        label += '\n\nSame track:\n' + trackConflicts.join(',\n');
        backgroundColor = '#e1f2fa';
      }

      const groupConflicts = [... new Set(slot.errors
        .filter(error => error.issue.type === 'group conflict')
        .map(error => error.detail.names)
        .flat())];
      if (groupConflicts.length > 0) {
        label += '\n\nGroup conflict:\n' + groupConflicts.join(',\n');
        backgroundColor = '#ddaeff'
      }

      const chairConflicts = [... new Set(slot.errors
        .filter(error => error.issue.type === 'chair conflict')
        .map(error => error.detail.names)
        .flat())];
      if (chairConflicts.length > 0) {
        label += '\n\nChair conflict:\n' + chairConflicts.join(',\n');
        backgroundColor = '#ddaeff'
      }

      slot.backgroundColor = backgroundColor;
      slot.value = SpreadsheetApp
        .newRichTextValue()
        .setText(label)
        .build();
      return slot;
    });
  sheet.getRange(startRow, startCol + 1, repeatedSlots.length)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center')
    .setFontWeight('bold')
    .setBorder(true, true, null, true, null, null);
  repeatedSlots.map((slot, idx) => {
    sheet.getRange(startRow + idx, startCol + 1, 1, 1)
      .setBackground(slot.backgroundColor)
      .setRichTextValue(slot.value);
  });
  sheet
    .autoResizeColumns(startCol, startCol + 1)
    .setFrozenColumns(startCol + 1);
}


/**
 * Return true if first slot is right after the second one in the list of slots
 */
function isRightAfter(slotAfter, slotBefore, slots) {
  const afterIndex = slots.findIndex(s => s.name === slotAfter);
  const beforeIndex = slots.findIndex(s => s.name === slotBefore);
  return (afterIndex - beforeIndex) === 1;
}

/**
 * Add the list of meetings
 */
function addSessions(sheet, project, validationErrors) {
  const startRow = 2;
  const startCol = 3;

  const meetings = project.sessions
    .map(session => {
      if (session.meetings) {
        return session.meetings.map(meeting =>
          Object.assign({ number: session.number }, meeting));
      }
      else if (session.room && session.day && session.slot) {
        return {
          number: session.number,
          room: session.room,
          day: session.day,
          slot: session.slot
        };
      }
      else {
        return null;
      }
    })
    .flat()
    .filter(meeting => meeting && meeting.room && meeting.day && meeting.slot);

  // Sort meetings since the editor may have changed the order from the canonical one.
  const sortedMeetings = Array.from(meetings);
  sortedMeetings.sort((m1, m2) => {
    const slot1 = project.slots.findIndex(s => s.name === m1.slot);
    const slot2 = project.slots.findIndex(s => s.name === m2.slot);
    const key1 = `${m1.number}-${m1.room}-${m1.day}-${slot1}`;
    const key2 = `${m2.number}-${m2.room}-${m2.day}-${slot2}`;
    if (key1 < key2) {
      return -1;
    } 
    else if (key1 > key2) {
      return 1;
    }
    else {
      return 0;
    }
  });

  // Convert the expanded list of meetings into a list of ranges that represent
  // the (possibly merged) cells of the grid.
  const ranges = sortedMeetings
    .reduce((ranges, meeting, idx) => {
      let errors = [];
      for (const issue of validationErrors) {
        if (!issue.details) {
          continue;
        }
        for (const detail of issue.details) {
          const issueMeeting = detail.meeting ?? detail;
          if (issueMeeting.day !== meeting.day ||
              issueMeeting.slot !== meeting.slot ||
              issueMeeting.room !== meeting.room) {
            continue;
          }
          errors.push({ issue, detail });
        }
      }

      const last = ranges.length > 0 ? ranges[ranges.length - 1] : null;
      if (last &&
          meeting.number === last.number &&
          meeting.day === last.day &&
          meeting.room === last.room &&
          isRightAfter(meeting.slot, last.slot, project.slots)) {
        last.numRows += 1;
        last.slot = meeting.slot;
        if (errors.length > 0) {
          last.errors.concat(errors);
        }
      }
      else {
        const dayIndex = project.days.findIndex(v => v.date === meeting.day || v.name === meeting.day);
        const slotIndex = project.slots.findIndex(v => v.name === meeting.slot);
        const roomIndex = project.rooms.findIndex(v => v.name === meeting.room);
        if (dayIndex === -1) {
          console.error(`- could not find day "${meeting.day}" for ${meeting.title} (#${meeting.number})`);
          return ranges;
        }
        if (slotIndex === -1) {
          console.error(`- could not find slot "${meeting.slot}" for ${meeting.title} (#${meeting.number})`);
          return ranges;
        }
        if (roomIndex === -1) {
          console.error(`- could not find room "${meeting.room}" for ${meeting.title} (#${meeting.number})`);
          return ranges;
        }
        const range = {
          row: startRow + (project.slots.length * dayIndex) + slotIndex,
          column: startCol + roomIndex,
          numRows: 1,
          numColumns: 1,
          number: meeting.number,
          day: meeting.day,
          slot: meeting.slot,
          room: meeting.room,
          firstIndex: idx,
          errors: errors
        };
        ranges.push(range);
      }
      return ranges;
    }, []);

  const sessionsSheetUrl = '#gid=' + project.sheets.sessions.sheet.getSheetId();
  for (const range of ranges) {
    const idx = project.sessions.findIndex(session => session.number === range.number);
    const session = project.sessions[idx];
    const sessionRange = `A${idx + 2}`;

    let backgroundColor = null;
    const capacityIssues = range.errors.filter(error =>
      error.issue.severity === 'warning' && error.issue.type === 'capacity');
    if (capacityIssues.length > 0) {
      backgroundColor = '#fcebbdc';
    }
    const trackIssues = range.errors.filter(error =>
      error.issue.severity === 'warning' && error.issue.type === 'track');
    if (trackIssues.length > 0) {
      backgroundColor = '#e1f2fa';
    }
    const peopleIssues = range.errors.filter(error =>
      error.issue.type === 'group conflict' ||
      error.issue.type === 'chair conflict');
    if (peopleIssues.length > 0) {
      backgroundColor = '#ddaeff';
    }
    const schedulingIssues = range.errors.filter(error =>
      error.issue.severity === 'error' && error.issue.type === 'scheduling');
    if (schedulingIssues.length > 0) {
      backgroundColor = '#f5ab9e';
    }
    if (!backgroundColor && range.errors.find(error =>
        error.issue.severity === 'warning')) {
      backgroundColor = '#fcebbd';
    }

    let label = `${session.title} (${session.number})`;
    if (project.metadata.type !== 'groups' && session.chairs) {
      label += '\n\nChair(s): ' + session.chairs.map(x => x.name).join(', ');
    }

    // Add tracks if needed
    const tracks = session.labels.filter(label => label.startsWith('track: '));
    if (tracks.length > 0) {
      for (const track of tracks) {
        label += `\n${track}`;
      }
    }

    const sessionIssues = range.errors.filter(error =>
      error.issue.session === session.number);
    const roomSwitchIssue = sessionIssues.find(error =>
      error.issue.severity === 'warning' && error.issue.type === 'switch');
    if (roomSwitchIssue) {
      const room = project.rooms.find(room => room.name === roomSwitchIssue.detail.previous.room);
      label += `\nPrevious slot in: ${room.label}`;
    }

    const conflictIssues = sessionIssues
      .filter(error =>
        error.issue.severity === 'warning' &&
        error.issue.type === 'conflict')
      .map(error => error);
    if (conflictIssues.length > 0) {
      label += '\nConflicts with: ' +
        conflictIssues
          .map(error => '#' + error.detail.conflictsWith.number)
          .join(', ');
    }

    const capacityIssue = capacityIssues
      .find(error => error.issue.session === session.number);
    if (capacityIssue) {
      label += '\nCapacity: ' + session.description.capacity;
    }

    const richValue = SpreadsheetApp.newRichTextValue()
        .setText(label)
        .setLinkUrl(
          session.title.length + 2,
          session.title.length + 2 + `${session.number}`.length,
          `${sessionsSheetUrl}&range=${sessionRange}`)
        .build();
    sheet.getRange(range.row, range.column, range.numRows, range.numColumns)
      .mergeVertically()
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('center')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setRichTextValue(richValue)
      .setBackground(backgroundColor);
  }
}


/**
 * Add borders per day to the grid
 */
function addBorders(sheet, project) {
  for (let i = 0; i < project.days.length; i++) {
    sheet.getRange(i * project.slots.length + 2, 1, 1, project.rooms.length + 2)
      .setBorder(true, null, null, null, null, null);
  }
  sheet.getRange(1, 1, sheet.getLastRow(), project.rooms.length + 2)
    .setBorder(true, true, true, true, null, null);
}
