import { getProject } from './lib/project.mjs';
import reportError from './lib/report-error.mjs';
import { parseSessionMeetings, serializeSessionMeetings } from '../common/meetings.mjs';

export default function () {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getActiveSheet();

    // To swap, we need the user to have selected two meetings in the schedule.
    // Meetings in the schedule may span multiple slots, so a meeting is a
    // range in the general case, not a single cell.
    console.log('Make sure that two meetings are selected...');
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
      reportError(`You must select two meetings in two different rooms.\nYou did not select any.`);
      return;
    }
    if (ranges.length === 1) {
      // Only one range selected, but perhaps that's because the user wants to
      // swap rooms that are next to each other in the grid. Let's split that
      // range if that's the case.
      const range = ranges[0];
      if (range.getNumColumns() !== 2) {
        reportError(`You must select two meetings in two different rooms.\nYou selected ${range.getNumColumns()} rooms.`);
        return;
      }
      ranges = [
        sheet.getRange(range.getRow(), range.getColumn(), range.getNumRows()),
        sheet.getRange(range.getRow(), range.getLastColumn(), range.getNumRows())
      ];
    }
    if (ranges.length !== 2) {
      reportError(`You must select two meetings in two different rooms.\nYou selected too many.`);
      return;
    }
    for (const range of ranges) {
      if (range.getNumColumns() > 1) {
        reportError(`You must select two meetings in two different rooms.\nOne of the ranges you selected (${range.getA1Notation()}) spans more than one room.`);
        return;
      }
      if (range.isPartOfMerge()) {
        const mergedRanges = range.getMergedRanges();
        if (mergedRanges.length !== 1) {
          reportError(`You must select two meetings in two different rooms.\nOne of the ranges you selected (${range.getA1Notation()}) encompasses more than one meeting.`);
          return;
        }
        if (range.getA1Notation() !== mergedRanges[0].getA1Notation()) {
          reportError(`You must select two meetings in two different rooms.\nOne of the ranges you selected (${range.getA1Notation()}) encompasses more than one meeting.`);
          return;
        }
      }
      else {
        if (range.getNumRows() !== 1) {
          reportError(`You must select two meetings in two different rooms.\nOne of the ranges you selected (${range.getA1Notation()}) encompasses more than one meeting.`);
          return;
        }
      }
    }
    if (ranges[0].getColumn() === ranges[1].getColumn()) {
      reportError(`You must select two meetings in two different rooms.\nMeetings you selected are scheduled in the same room.`);
      return;
    }

    const selectedSessions = ranges
      .map(range => range.getRichTextValue().getRuns()
        .find(run => run.getText().match(/^\d+$/) && run.getLinkUrl()))
      .map(run => run?.getText())
      .map(nbStr => nbStr ? ({ number: Number(nbStr) }) : null);
    if (!selectedSessions[0]) {
      reportError(`First meeting you selected (${ranges[0].getA1Notation()}) does not look like one.`);
      return;
    }
    if (!selectedSessions[1]) {
      reportError(`Second meeting you selected (${ranges[1].getA1Notation()}) does not look like one.`);
      return;
    }
    selectedSessions[0].range = ranges[0];
    selectedSessions[1].range = ranges[1];

    for (const session of selectedSessions) {
      console.log(`- selected session: ${session.number} - ${session.range.getValue()}`);
      let dayRange = sheet.getRange(session.range.getRow(), 1, 1);
      if (dayRange.isPartOfMerge()) {
        const mergedRanges = dayRange.getMergedRanges();
        dayRange = mergedRanges[0];
      }
      session.selectedMeeting = {
        room: sheet.getRange(1, session.range.getColumn(), 1).getValue().split('\n')[0],
        day: dayRange.getValue(),
        slots: []
      };
      for (let i=session.range.getRow(); i<=session.range.getLastRow(); i++) {
        session.selectedMeeting.slots.push(sheet.getRange(i, 2, 1).getValue());
      }
    }
    if (selectedSessions[0].selectedMeeting.day !== selectedSessions[1].selectedMeeting.day) {
      reportError(`Cannot swap selected meetings as they are scheduled on different days: ${selectedSessions[0].selectedMeeting.day} and ${selectedSessions[1].selectedMeeting.day}.`);
      return;
    }
    if (!selectedSessions[0].selectedMeeting.slots.every(slot => selectedSessions[1].selectedMeeting.slots.find(s => s === slot))) {
      reportError(`Cannot swap selected meetings as they are not scheduled during the same slots.`);
      return;
    }
    selectedSessions[0].selectedMeeting.newRoom = selectedSessions[1].selectedMeeting.room;
    selectedSessions[1].selectedMeeting.newRoom = selectedSessions[0].selectedMeeting.room;
    console.log(JSON.stringify(selectedSessions, null, 2));
    console.log('Make sure that two meetings are selected... done');

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

    console.log('Find selected meetings in the schedule...');
    for (const session of selectedSessions) {
      const sessionSchedule = schedule.find(row => row[0] === session.number);
      if (!sessionSchedule) {
        reportError(`Could not find session ${session.number} in the schedule.`);
        return;
      }
      session.room = sessionSchedule[1];
      // Note: day used to be recorded separately from slot (hence missing "2")
      session.slot = sessionSchedule[3];
      session.meeting = sessionSchedule[4];
      session.tracks = sessionSchedule[5];
      session.meetings = parseSessionMeetings(session, project);
      session.selectedMeeting.splitMeetings = session.selectedMeeting.slots.map(selSlot => {
        const daySlot = project.slots.find(slot =>
          slot.date === session.selectedMeeting.day ||
          slot.weekday.toLowerCase() === session.selectedMeeting.day.toLowerCase());
        return {
          room: session.selectedMeeting.room,
          day: daySlot?.date ?? session.selectedMeeting.day,
          slot: selSlot.split('-')[0].trim()
        };
      });
      if (!session.selectedMeeting.splitMeetings.every(meeting => session.meetings.find(m => m.room === meeting.room && m.day === meeting.day && m.slot === meeting.slot))) {
        reportError(`Could not find selected meeting for ${session.number} in the schedule. Something is wrong with this schedule, I'm afraid. Please report the error.`);
        return;
      }
    }
    console.log('Find selected meetings in the schedule... done');

    // TODO: extend selection of sessions as needed? Or at least allow swapping when part of the other slot is empty
    
    console.log('Swap rooms in the schedule...');
    for (const session of selectedSessions) {
      for (const meeting of session.meetings) {
        const isSelectedMeeting = session.selectedMeeting.splitMeetings.find(m =>
          m.room === meeting.room && m.day === meeting.day && m.slot === meeting.slot);
        if (!isSelectedMeeting) {
          continue;
        }
        meeting.room = session.selectedMeeting.newRoom;
      }
      const sessionUpdate = {
        room: null,
        meeting: null,
        slot: null
      };
      if (project.allowMultipleMeetings) {
        const { room, meeting } = serializeSessionMeetings(session.meetings, project);
        if (room) {
          sessionUpdate.room = room;
        }
        sessionUpdate.meeting = meeting;
      }
      else {
        sessionUpdate.room = session.meetings[0].room;
        sessionUpdate.slot = session.meetings[0].day + ' ' + session.meetings[0].slot;
      }
      const sessionSchedule = schedule.find(row => row[0] === session.number);
      sessionSchedule[1] = sessionUpdate.room;
      sessionSchedule[3] = sessionUpdate.slot;
      sessionSchedule[4] = sessionUpdate.meeting;
      console.log(`- updated schedule for ${session.number}`, sessionSchedule);
    }
    scheduleMetadata.setValue(JSON.stringify(schedule));
    console.log('Swap rooms in the schedule... done');

    // TODO: Rooms capacities are likely different, need to revalidate and
    // adjust colors and label as needed
    console.log('Swap cell contents...');
    const tempValue = selectedSessions[0].range.getRichTextValue();
    const tempBackground = selectedSessions[0].range.getBackground();
    selectedSessions[0].range.setRichTextValue(selectedSessions[1].range.getRichTextValue());
    selectedSessions[0].range.setBackground(selectedSessions[1].range.getBackground());
    selectedSessions[1].range.setRichTextValue(tempValue);
    selectedSessions[1].range.setBackground(tempBackground);
    console.log('Swap cell contents... done');

    SpreadsheetApp.flush();
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}