import { groupSessionMeetings } from '../../common/meetings.mjs';
import { Srand } from '../../common/jsrand.mjs';
import { getProjectSlot } from '../../common/project.mjs';

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
    spreadsheet.getNumSheets()
  );
  console.log('- clear sheet');
  sheet.clear();
  console.log('- attach result as metadata');
  const metadata = project.sessions.map(session => [
    session.number,
    session.room,
    // Note: day used to be recorded separately from slot
    '',
    session.slot,
    session.meeting,
    session.tracks
  ]);
  sheet.addDeveloperMetadata('SCHEDULE', JSON.stringify(metadata));
  console.log('- create headers row');
  createHeaderRow(sheet, project.rooms);
  console.log('- create days/slots headers');
  createDaySlotColumns(sheet, project.slots, validationErrors);
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
    spreadsheet.getNumSheets()
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
      const slot1 = project.slots.find(slot =>
        slot.date === m1.day &&
        slot.start === m1.start);
      const slot2 = project.slots.find(slot =>
        slot.date === m2.day &&
        slot.start === m2.start);
      if (slot1.date < slot2.date) {
        return -1;
      }
      else if (slot1.date > slot2.date) {
        return 1;
      }
      else if (slot1.start < slot2.start) {
        return -1;
      }
      else if (slot1.start > slot2.start) {
        return 1;
      }
      else {
        return 0;
      }
    })
    .map(meeting => {
      const slot = project.slots.find(slot =>
        slot.date === meeting.day &&
        slot.start === meeting.start);
      const room = project.rooms.find(room => room.name === meeting.room);
      return `${slot.weekday}, ${meeting.start}-${meeting.end}` +
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
function createDaySlotColumns(sheet, slots, validationErrors) {
  const startRow = 2; // Start after the header row
  const startCol = 1; // Start in first column

  const perDate = {};
  for (const slot of slots) {
    if (!perDate[slot.date]) {
      perDate[slot.date] = {
        date: slot.date,
        weekday: slot.weekday,
        slots: []
      };
    }
    perDate[slot.date].slots.push(slot);
  }

  for (let i = 0; i < Object.keys(perDate).length; i++) {
    const day = Object.keys(perDate)[i];
    const daySlots = perDate[day].slots;
    sheet.getRange(startRow + (i * daySlots.length), startCol, daySlots.length)
      .mergeVertically()
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('center')
      .setFontWeight('bold')
      .setBackground('#fce5cd')
      .setValue(perDate[day].weekday);
  }

  // Note: slots should already be sorted per day
  const repeatedSlots = slots
    .map(slot => {
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
          if (slot.date !== meeting.day || slot.start !== meeting.start) {
            continue;
          }
          slot.errors.push({ issue, detail });
        }
      }
      return slot;
    })
    .map(slot => {
      let label = slot.start + '-' + slot.end;
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
function isRightAfter(date, slotAfter, slotBefore, slots) {
  const afterIndex = slots.findIndex(s => s.date === date && s.start === slotAfter);
  const beforeIndex = slots.findIndex(s => s.date === date && s.start === slotBefore);
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
      else if (session.room && session.slot) {
        const slot = getProjectSlot(project, session.slot);
        return {
          number: session.number,
          room: session.room,
          day: slot?.date,
          slot: slot?.slot
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
    const slot1 = project.slots.findIndex(s =>
      s.date === m1.date && s.start === m1.start);
    const slot2 = project.slots.findIndex(s =>
      s.date === m2.date && s.start === m2.start);
    const key1 = `${m1.number}-${m1.room}-${slot1.date}-${slot1.start}`;
    const key2 = `${m2.number}-${m2.room}-${slot2.date}-${slot2.start}`;
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
          isRightAfter(meeting.day, meeting.slot, last.slot, project.slots)) {
        last.numRows += 1;
        last.slot = meeting.slot;
        if (errors.length > 0) {
          last.errors.concat(errors);
        }
      }
      else {
        const slotIndex = project.slots.findIndex(v =>
          v.date === meeting.day && v.start === meeting.slot);
        const roomIndex = project.rooms.findIndex(v => v.name === meeting.room);
        if (slotIndex === -1) {
          console.error(`- could not find slot "${meeting.day} ${meeting.slot}" for ${meeting.title} (#${meeting.number})`);
          return ranges;
        }
        if (roomIndex === -1) {
          console.error(`- could not find room "${meeting.room}" for ${meeting.title} (#${meeting.number})`);
          return ranges;
        }
        const range = {
          row: startRow + slotIndex,
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

  function findSessionRange(project, number) {
    const idx = project.sessions.findIndex(session =>
      session.number === number);
    const session = project.sessions[idx];
    return `A${idx + 2}`;
  }

  const sessionsSheetUrl = '#gid=' + project.sheets.sessions.sheet.getSheetId();
  for (const range of ranges) {
    const idx = project.sessions.findIndex(session => session.number === range.number);
    const session = project.sessions[idx];
    const sessionRange = findSessionRange(project, range.number);

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

    const tokens = [];
    tokens.push({ label: session.title });
    tokens.push({ label: ' (' });
    tokens.push({
      label: '' + session.number,
      href: `${sessionsSheetUrl}&range=${sessionRange}`
    });
    tokens.push({ label: ')' });

    if (project.metadata.type !== 'groups' && session.chairs) {
      tokens.push({
        label: '\n\nChair(s): ' + session.chairs.map(x => x.name).join(', ')
      });
    }

    // Add tracks if needed
    for (const track of session.tracks ?? []) {
      tokens.push({ label: `\n${track}` });
    }

    // In the conflict list, highlight actual conflicts with conflictHighlight
    const conflictHighlight = SpreadsheetApp.newTextStyle().setForegroundColor('#eb344f').build();
    const conflictIssues = sessionIssues
      .filter(error =>
        error.issue.severity === 'warning' &&
        error.issue.type === 'conflict')
      .map(error => error);

    if (session.description.conflicts?.length) {
      tokens.push({ label: '\nAvoid conflicts with: ' });
      let first = true;
      for (const number of session.description.conflicts) {
        if (!first) {
          tokens.push({ label: ', ' });
        }
        first = false;
        tokens.push({
	  ...(true) && {label: '#' + number, href: `${sessionsSheetUrl}&range=${findSessionRange(project, number)}`},
	  ...conflictIssues.includes(number) && {style: conflictHighlight}
        });
      }
    }

    const sessionIssues = range.errors.filter(error =>
      error.issue.session === session.number);
    const roomSwitchIssue = sessionIssues.find(error =>
      error.issue.severity === 'warning' && error.issue.type === 'switch');
    if (roomSwitchIssue) {
      const room = project.rooms.find(room => room.name === roomSwitchIssue.detail.previous.room);
      tokens.push({ label: `\n[warn] Previous slot in: ${room.name}` });
    }


    const capacityIssue = capacityIssues
      .find(error => error.issue.session === session.number);
    if (capacityIssue) {
      tokens.push({
        label: '\n[warn] Capacity: ' + session.description.capacity
      });
    }

    const richValueBuilder = SpreadsheetApp.newRichTextValue();
    richValueBuilder.setText(tokens.map(token => token.label).join(''));
    let pos = 0;
    for (const token of tokens) {
      if (token.href) {
        richValueBuilder.setLinkUrl(
          pos, pos + token.label.length,
          token.href);
      }
      if (token.style) {
        richValueBuilder.setTextStyle(
          pos, pos + token.label.length,
          token.style);
      }
      pos += token.label.length;
    }
    const richValue = richValueBuilder.build();
    sheet.getRange(range.row, range.column, range.numRows, range.numColumns)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .mergeVertically()
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('center')
      .setRichTextValue(richValue)
      .setBackground(backgroundColor);
  }
}


/**
 * Add borders per day to the grid
 */
function addBorders(sheet, project) {
  const perDate = {};
  for (const slot of project.slots) {
    if (!perDate[slot.date]) {
      perDate[slot.date] = {
        date: slot.date,
        weekday: slot.weekday,
        slots: []
      };
    }
    perDate[slot.date].slots.push(slot);
  }
  for (const [date, desc] of Object.entries(perDate)) {
    const slotPos = project.slots.findIndex(slot =>
      slot.start === desc.slots[0].start);
    sheet.getRange(slotPos + 2, 1, 1, project.rooms.length + 2)
      .setBorder(true, null, null, null, null, null);
  }
  sheet.getRange(1, 1, sheet.getLastRow(), project.rooms.length + 2)
    .setBorder(true, true, true, true, null, null);
}
