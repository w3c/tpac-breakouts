import {
  getProject, refreshProject, saveSessionValidationInSheet
} from './lib/project.mjs';
import reportError from './lib/report-error.mjs';
import { fetchMapping } from './lib/w3cid-map.mjs';
import { fetchRegistrants } from '../common/registrants.mjs';
import { validateGrid } from '../common/validate.mjs';
import { parseSessionMeetings } from '../common/meetings.mjs';

export default async function () {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  try {
    console.log('Read schedule from current sheet...');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const developerMetaDataList = sheet.getDeveloperMetadata();
    const scheduleMetadata = developerMetaDataList.find(meta =>
      meta.getKey() === 'SCHEDULE');
    if (!scheduleMetadata) {
      reportError(`The current sheet "${sheet.getName()}" is not a valid schedule!`);
      return;
    }
    const schedule = JSON.parse(scheduleMetadata.getValue());
    console.log(schedule);
    console.log('Read schedule from current sheet... done');

    console.log('Read data from spreadsheet...');
    const project = getProject(spreadsheet);
    project.w3cIds = await fetchMapping();
    if (!project.sheets.sessions.sheet) {
      reportError('No sheet found that contains the list of sessions, please import data from GitHub first.');
      return;
    }
    console.log('Read data from spreadsheet... done');

    console.log('Apply the schedule...');
    for (const session of project.sessions) {
      const sessionSchedule = schedule.find(row => row[0] === session.number);
      if (sessionSchedule) {
        session.room = sessionSchedule[1];
        // Note: day used to be recorded separately from slot (hence missing "2")
        session.slot = sessionSchedule[3];
        session.meeting = sessionSchedule[4];
        session.tracks = sessionSchedule[5];
        session.meetings = parseSessionMeetings(session, project);
      }
      else {
        console.log(`- no schedule info for session #${session.number}`);
      }
    }
    console.log('Apply the schedule... done');

    if (project.metadata.type === 'groups') {
      console.log('Fetch registrants...');
      await fetchRegistrants(project);
      console.log('Fetch registrants... done');
    }

    console.log(`Validate new schedule...`);
    const { errors: newErrors, changes: newChanges } = await validateGrid(project, { what: 'scheduling' })
    if (newErrors.length) {
      for (const error of newErrors) {
        console.warn(`- [${error.severity}: ${error.type}] #${error.session}: ${error.messages.join(', ')}`);
      }
    }
    else {
      console.log(`- looks good!`);
    }
    for (const change of newChanges) {
      console.warn(`- save validation problems for session ${change.number}`);
      const session = project.sessions.find(s => s.number === change.number);
      session.validation.error = change.validation.error;
      session.validation.warning = change.validation.warning;
      session.validation.check = change.validation.check;
      await saveSessionValidationInSheet(session, project);
    }
    console.log(`Validate new schedule... done`);

    console.log('Update meeting info in sessions sheet...');
    refreshProject(spreadsheet, project, { what: 'schedule' });
    console.log('Update meeting info in sessions sheet... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}
