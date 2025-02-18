import { getProject } from './project.mjs';
import reportError from './report-error.mjs';

/**
 * Generate the grid for the current spreadsheet
 */
export default function () {
  return generateGrid(SpreadsheetApp.getActiveSpreadsheet());
}


/**
 * Generate the grid in the provided spreadsheet
 */
function generateGrid(spreadsheet) {
  try {
    console.log('Read data from spreadsheet...');
    const project = getProject(spreadsheet);
    if (!project.sheets.sessions.sheet) {
      reportError('No sheet found that contains the list of sessions, please import data from GitHub first.');
      return;
    }
    console.log('Read data from spreadsheet... done');

    console.log('Generate grid sheet...');
    const sheet = project.sheets.grid.sheet;
    sheet.clear();
    console.log('- sheet cleared');
    createHeaderRow(sheet, project.rooms);
    console.log('- header row created');
    createDaySlotColumns(sheet, project.days, project.slots);
    console.log('- days/slots headers created');
    addSessions(sheet,
      project.sessions,
      project.sessions,  // TODO: real meetings for TPAC group meetings!
      project.rooms,
      project.days,
      project.slots,
      spreadsheet.getUrl() + '#gid=' + project.sheets.meetings.sheet.getSheetId()
    );
    console.log('- sessions added to the grid');
    addBorders(sheet,
      project.rooms,
      project.days,
      project.slots
    );
    console.log('- borders added');
    console.log('Generate grid sheet... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}


/**
 * Create the header row of the grid view with the list of rooms.
 *
 * TODO: auto resize does not work that well, need more margin around the labels!
 */
function createHeaderRow(sheet, rooms) {
  const labels = rooms.map(room => `${room.name}\n${room.location}`);
  const values = [['Days', 'Slots'].concat(labels)];
  sheet.getRange(1, 1, values.length, values[0].length)
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center')
    .setBackground('#c27ba0')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
    .setValues(values)
  sheet
    .autoResizeColumns(2, rooms.length)
    .setFrozenRows(1);
}


/**
 * Create the day/slot columns of the grid view
 */
function createDaySlotColumns(sheet, days, slots) {
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
  const repeatedSlots = days.map(day => slots).flat();
  sheet.getRange(startRow, startCol + 1, repeatedSlots.length)
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('center')
    .setFontWeight('bold')
    .setBorder(true, true, null, true, null, null)
    .setValues(repeatedSlots.map(slot => [slot.name]));
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
function addSessions(sheet, sessions, meetings, rooms, days, slots, meetingsSheetUrl) {
  const startRow = 2;
  const startCol = 3;

  // TODO: consider re-computing meetings data from sessions

  // Sort meetings since the editor may have changed the order from the canonical one.
  const sortedMeetings = Array.from(meetings);
  sortedMeetings.sort((m1, m2) => {
    const slot1 = slots.findIndex(s => s.name === m1.slot);
    const slot2 = slots.findIndex(s => s.name === m2.slot);
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
      const last = ranges.length > 0 ? ranges[ranges.length - 1] : null;
      if (last &&
          meeting.number === last.number &&
          meeting.day === last.day &&
          meeting.room === last.room &&
          isRightAfter(meeting.slot, last.slot, slots)) {
        last.numRows += 1;
        last.slot = meeting.slot;
      }
      else {
        const dayIndex = days.findIndex(v => v.date === meeting.day);
        const slotIndex = slots.findIndex(v => v.name === meeting.slot);
        const roomIndex = rooms.findIndex(v => v.name === meeting.room);
        const range = {
          row: startRow + (slots.length * dayIndex) + slotIndex,
          column: startCol + roomIndex,
          numRows: 1,
          numColumns: 1,
          number: meeting.number,
          day: meeting.day,
          slot: meeting.slot,
          room: meeting.room,
          firstIndex: idx
        };
        ranges.push(range);
      }
      return ranges;
    }, []);
  
  // TODO: Use a cleaner mechanism to detect that we're dealing with breakout sessions
  // and not with group meetings
  const breakouts = !!meetings.find(meeting => meeting.title && meeting.body);

  for (const range of ranges) {
    const session = sessions.find(session => session.number === range.number);
    const firstMeeting = sortedMeetings[range.firstIndex];
    const firstIndex = meetings.findIndex(m => m === firstMeeting);
    const meetingRange = breakouts ?
      `A${firstIndex + 2}` :
      `A${firstIndex + 2}:D${firstIndex + 1 + range.numRows}`;
    const richValue = SpreadsheetApp.newRichTextValue()
        .setText(`${session.title} (${session.number})`)
        .setLinkUrl(`${meetingsSheetUrl}&range=${meetingRange}`)
        .build();
    sheet.getRange(range.row, range.column, range.numRows, range.numColumns)
      .mergeVertically()
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('center')
      .setBackground('#b7e1cd')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .setRichTextValue(richValue);
  }
}


/**
 * Add borders per day to the grid
 */
function addBorders(sheet, rooms, days, slots) {
  for (let i = 0; i < days.length; i++) {
    sheet.getRange(i * slots.length + 2, 1, 1, rooms.length + 2)
      .setBorder(true, null, null, null, null, null);
  }
  sheet.getRange(1, 1, sheet.getLastRow(), rooms.length + 2)
    .setBorder(true, true, true, true, null, null);
}
