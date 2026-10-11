import { getProject } from './lib/project.mjs';
import reportError from './lib/report-error.mjs';
import { parseSessionMeetings, serializeSessionMeetings } from '../common/meetings.mjs';

export default function () {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getActiveSheet();

    // The user must have selected one meeting in the schedule.
    // Meetings in the schedule may span multiple slots, so a meeting is a
    // range in the general case, not a single cell.
    console.log('Make sure that one meetings is selected...');
    const selection = sheet.getSelection();
    let ranges = selection.getActiveRangeList().getRanges();
    /*for (let i = 0; i < ranges.length; i++) {
      console.log(`- range ${i}: ${ranges[i].getA1Notation()}`);
      console.log(`- range ${i} is part of merge: ${ranges[i].isPartOfMerge()}`);
      const mergedRanges = ranges[i].getMergedRanges();
      for (let j = 0; j < mergedRanges.length; j++) {
        console.log(`- range ${i} merged range ${j}: ${mergedRanges[j].getA1Notation()}`);
      }
    }*/
    if (ranges.length === 0) {
      reportError('You must select one meeting in the schedule. You have not selected any.');
      return;
    }
    if (ranges.length !== 1) {
      reportError('You must select only one meeting in the schedule. You seem to have selected more than one.');
      return;
    }
    const range = ranges[0];
    if (range.getNumColumns() !== 1) {
      reportError('You must select only one meeting in the schedule. You seem to have selected more than one.');
      return;
    }
    if (range.isPartOfMerge()) {
      const mergedRanges = range.getMergedRanges();
      if (mergedRanges.length !== 1) {
        reportError(`You must select only one meeting in the schedule. The range you selected (${range.getA1Notation()}) encompasses more than one.`);
        return;
      }
      if (range.getA1Notation() !== mergedRanges[0].getA1Notation()) {
        reportError(`You must select only one meeting in the schedule. The range you selected (${range.getA1Notation()}) encompasses more than one.`);
        return;
      }
    }
    else {
      if (range.getNumRows() !== 1) {
        reportError(`You must select only one meeting in the schedule. The range you selected (${range.getA1Notation()}) encompasses more than one.`);
        return;
      }
    }

    const selectedSessionId = range.getRichTextValue().getRuns()
      .find(run => run.getText().match(/^\d+$/) && run.getLinkUrl())
      ?.getText();
    const selectedSession = selectedSessionId ? ({
      number: Number(selectedSessionId),
      range
    }) : null;
    if (!selectedSession) {
      reportError(`You must select only one meeting in the schedule. The range you selected (${range.getA1Notation()}) does not look like one.`);
      return;
    }

    console.log(`- selected session: ${selectedSession.number} - ${selectedSession.range.getValue()}`);
    let dayRange = sheet.getRange(session.range.getRow(), 1, 1);
    if (dayRange.isPartOfMerge()) {
      const mergedRanges = dayRange.getMergedRanges();
      dayRange = mergedRanges[0];
    }
    selectedSession.selectedMeeting = {
      room: sheet.getRange(1, selectedSession.range.getColumn(), 1).getValue().split('\n')[0],
      day: dayRange.getValue(),
      slots: []
    };
    for (let i=selectedSession.range.getRow(); i<=selectedSession.range.getLastRow(); i++) {
      selectedSession.selectedMeeting.slots.push(sheet.getRange(i, 2, 1).getValue());
    }
    console.log(JSON.stringify(selectedSession, null, 2));
    console.log('Make sure that one meeting is selected... done');

    console.log('Read data from spreadsheet...');
    const project = getProject(spreadsheet);
    if (!project.sheets.sessions.sheet) {
      reportError('No sheet found that contains the list of sessions, please import data from GitHub first.');
      return;
    }
    console.log('Read data from spreadsheet... done');

    console.log('Read schedule from current sheet...');
    const developerMetaDataList = sheet.getDeveloperMetadata();
    const scheduleMetadata = developerMetaDataList.find(meta =>
      meta.getKey() === 'SCHEDULE');
    if (!scheduleMetadata) {
      reportError(`The current sheet "${sheet.getName()}" is not a valid schedule!`);
      return;
    }
    const schedule = JSON.parse(scheduleMetadata.getValue());
    console.log('Read schedule from current sheet... done');

    console.log('Find selected meeting in the schedule...');
    const sessionSchedule = schedule.find(row => row[0] === selectedSession.number);
    if (!sessionSchedule) {
      reportError(`Could not find session ${selectedSession.number} in the schedule.`);
      return;
    }
    selectedSession.room = sessionSchedule[1];
    // Note: day used to be recorded separately from slot (hence missing "2")
    selectedSession.slot = sessionSchedule[3];
    selectedSession.meeting = sessionSchedule[4];
    selectedSession.tracks = sessionSchedule[5];
    selectedSession.meetings = parseSessionMeetings(selectedSession, project);
    selectedSession.selectedMeeting.splitMeetings = selectedSession.selectedMeeting.slots.map(selSlot => {
      const daySlot = project.slots.find(slot =>
        slot.date === selectedSession.selectedMeeting.day ||
        slot.weekday.toLowerCase() === selectedSession.selectedMeeting.day.toLowerCase());
      return {
        room: selectedSession.selectedMeeting.room,
        day: daySlot?.date ?? selectedSession.selectedMeeting.day,
        slot: selSlot.split('-')[0].trim()
      };
    });
    if (!selectedSession.selectedMeeting.splitMeetings.every(meeting => selectedSession.meetings.find(m => m.room === meeting.room && m.day === meeting.day && m.slot === meeting.slot))) {
      reportError(`Could not find selected meeting for ${selectedSession.number} in the schedule. Something is wrong with this schedule, I'm afraid. Please report the error.`);
      return;
    }
    console.log('Find selected meeting in the schedule... done');

    console.log('Ask user to select a new room...');
    const parsedSchedule = schedule.map(row => ({
      number: row[0],
      meetings: parseSessionMeetings({
        room: row[1],
        slot: row[3],
        meeting: row[4],
        tracks: row[5]
      }, project)
    }));
    const availableRooms = project.rooms.filter(room =>
      room.name !== selectedSession.selectedMeeting.room &&
      !parsedSchedule.find(session => session.meetings.some(meeting =>
        meeting.room === room.name &&
        selectedSession.selectedMeeting.splitMeetings.some(m => m.day === meeting.day && m.slot === meeting.slot)
      ))
    );
    if (availableRooms.length === 0) {
      reportError('Schedule is too full, no other room are available for this meeting!');
      return;
    }

    // TODO: Provide user with a list of rooms to choose from
    const ui = SpreadsheetApp.getUi();
    const promptResult = ui.prompt(
      "Target room name",
      "Please enter the name of the new room for the meeting:",
      ui.ButtonSet.OK_CANCEL,
    );
    const newRoom = promptResult.getResponseText();
    if (promptResult.getSelectedButton() !== ui.Button.OK) {
      // User canceled
      return;
    }
    const actualRoom = project.rooms.find(room => room.name.toLowerCase() === newRoom.toLowerCase());
    if (!actualRoom) {
      reportError(`No room "${newRoom}" found.`);
      return;
    }
    if (!availableRooms.find(room => room === actualRoom)) {
      reportError(`Room ${newRoom} is not available for the meeting.`);
      return;
    }
    console.log(`- move meeting to room: ${newRoom}`);
    console.log('Ask user to select a new room... done');

    console.log('Move meeting to the new room in the schedule...');
    for (const meeting of selectedSession.meetings) {
      const isSelectedMeeting = selectedSession.selectedMeeting.splitMeetings.find(m =>
        m.room === meeting.room && m.day === meeting.day && m.slot === meeting.slot);
      if (!isSelectedMeeting) {
        continue;
      }
      meeting.room = actualRoom.name;
    }
    const sessionUpdate = {
      room: null,
      meeting: null,
      slot: null
    };
    if (project.allowMultipleMeetings) {
      const { room, meeting } = serializeSessionMeetings(selectedSession.meetings, project);
      if (room) {
        sessionUpdate.room = room;
      }
      sessionUpdate.meeting = meeting;
    }
    else {
      sessionUpdate.room = selectedSession.meetings[0].room;
      sessionUpdate.slot = selectedSession.meetings[0].day + ' ' + selectedSession.meetings[0].slot;
    }
    sessionSchedule[1] = sessionUpdate.room;
    sessionSchedule[3] = sessionUpdate.slot;
    sessionSchedule[4] = sessionUpdate.meeting;
    console.log(`- updated schedule for ${selectedSession.number}:`, sessionSchedule);
    scheduleMetadata.setValue(JSON.stringify(schedule));
    console.log('Move meeting to the new room in the schedule... done');

    // TODO: Rooms capacities are likely different, need to revalidate and
    // adjust colors and label as needed
    console.log('Move cell to new column...');
    const roomsRange = sheet.getRange(`R1C3:R1C${3 + project.rooms.length}`);
    const newRoomTextFinder = roomsRange.createTextFinder('^' + actualRoom.name + '($|\n)')
      .useRegularExpression(true)
      .ignoreDiacritics(false)
      .matchCase(true)
      .matchEntireCell(false);
    const newRoomRange = newRoomTextFinder.findNext();
    if (!newRoomRange) {
      reportError(`Could not find the column associated with selected room "${newRoom}" in the grid`);
      return;
    }
    console.log(`- new room found in ${newRoomRange.getA1Notation()}`);
    const newRange = sheet.getRange(range.getRow(), newRoomRange.getColumn(), range.getNumRows(), 1)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)
      .mergeVertically()
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('center')
      .setRichTextValue(range.getRichTextValue())
      .setBackground(range.getBackground());
    range.clear().breakApart();
    console.log('Move cell to new column... done');

    SpreadsheetApp.flush();
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}