import reportError from './lib/report-error.mjs';
import {
  getProject,
  syncProjectWithGitHub,
  exportSchedule
} from './lib/project.mjs';
import {
  fetchProjectFromGitHub,
  saveSessionMeetings,
  saveSessionNote } from '../common/project.mjs';
import { getEnvKey } from '../common/envkeys.mjs';
import { exportMapping } from './lib/w3cid-map.mjs';

/**
 * Mapping for day gets done on the name or date for historical reasons.
 */
function getDate(day) {
  if (day?.match(/ \((.+)\)$/)) {
    return day.match(/ \((.*)\)$/)[1];
  }
  else {
    return day ?? '';
  }
}

export default async function () {
  try {
    console.log('Read data from spreadsheet...');
    const project = getProject(SpreadsheetApp.getActiveSpreadsheet());
    console.log('Read data from spreadsheet... done');

    if (!project.metadata.reponame) {
      reportError(`No GitHub repository associated with the current document.

  Make sure that the "GitHub repository name" parameter is set in the "Event" sheet.

  Also make sure the targeted repository and project have been properly initialized.
  If not, ask François or Ian to run the required initialization steps.`);
      return;
    }

    const repoparts = project.metadata.reponame.split('/');
    const repo = {
      owner: repoparts.length > 1 ? repoparts[0] : 'w3c',
      name: repoparts.length > 1 ? repoparts[1] : repoparts[0]
    };

    console.log('Fetch data from GitHub...');
    const githubProject = await fetchProjectFromGitHub(
      repo.owner === 'w3c' ? repo.owner : `user/${repo.owner}`,
      repo.name,
      null
    );
    console.log('Fetch data from GitHub... done');

    console.log('Export updates when needed...');
    const updated = [];
    for (const ghSession of githubProject.sessions) {
      const ssSession = project.sessions.find(s =>
        s.number === ghSession.number);
      if (!ssSession) {
        const htmlOutput = HtmlService
          .createHtmlOutput(`
            <p>Sorry, I did not export anything because I detected a new
            session in the GitHub repository that is not in the spreadsheet yet:
            </p>
            <blockquote>
              <p>${ghSession.title}
              (<a href="https://github.com/${ghSession.repository}/issues/${ghSession.number}">#${ghSession.number}</a>)
              </p>
            </blockquote>
            <p>Please run <b>Event > Refresh sessions/groups (from GitHub)</b>
            first to retrieve it. You may also need to propose and adopt a
            new schedule afterwards!</p>`
          )
          .setWidth(400)
          .setHeight(400);
        SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Not up-to-date!');
        return;
      }

      // TODO: handle meeting column for TPAC group meetings

      if (((ghSession.room ?? '') !== (ssSession.room ?? '')) ||
          (getDate(ghSession.day) !== getDate(ssSession.day)) ||
          ((ghSession.slot ?? '') !== (ssSession.slot ?? ''))) {
        console.warn(`- updating meeting info for #${ghSession.number}...`);
        ghSession.room = ssSession.room;
        ghSession.day = ssSession.day;
        ghSession.slot = ssSession.slot;
        await saveSessionMeetings(ghSession, githubProject);
        updated.push(ghSession);
        console.warn(`- updating meeting info for #${ghSession.number}... done`);
      }

      if ((ghSession.validation.note ?? '') !== (ssSession.validation.note ?? '')) {
        console.warn(`- updating note for #${ghSession.number}...`);
        await saveSessionNote(ghSession, ssSession.validation.note, githubProject);
        console.warn(`- updating note for #${ghSession.number}... done`);
      }
    }
    console.log('Export updates when needed... done');

    console.log('Export project metadata...');
    await syncProjectWithGitHub(project, githubProject);
    console.log('Export project metadata... done');

    console.log('Export schedule...');
    await exportSchedule(project, githubProject);
    console.log('Export schedule... done');

    console.log('Export W3CID_MAP mapping...');
    await exportMapping(project);
    console.log('Export W3CID_MAP mapping... done');

    if (project.metadata.calendar &&
        project.metadata.calendar !== 'no') {
      console.log('Trigger calendar publication...');
      const GRAPHQL_TOKEN = await getEnvKey('GRAPHQL_TOKEN');
      const options = {
        method : 'post',
        contentType: 'application/json',
        payload : JSON.stringify({
          ref: 'main',
          inputs: {
            sessionNumber: 'all',
            calendarstatus: project.metadata.calendar
          }
        }),
        headers: {
          Authorization: `Bearer ${GRAPHQL_TOKEN}`
        },
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(
        `https://api.github.com/repos/${repo.owner}/${repo.name}/actions/workflows/update-calendar.yml/dispatches`,
        options);
      const status = response.getResponseCode();
      if (status !== 200 && status !== 204) {
        reportError(`I could not start the job that refreshes the W3C calendar.

          You may need to do that manually through the GitHub repository.`
        );
        return;
      }
      console.log('Trigger calendar publication... done');
    }

    console.log('Report result...');
    if (updated.length > 0) {
      const list = updated.map(s =>
        `${s.title} (<a href="https://github.com/${s.repository}/issues/${s.number}">#${s.number}</a>)`);
      const calendar = (
        project.metadata.calendar && project.metadata.calendar !== 'no'
      ) ? `<p>
        Please allow a few minutes for the W3C calendar to get updated,
        and up to an hour for the schedule to reach the event's page on
        w3.org (if it exists).
        </p>` : '';
      const htmlOutput = HtmlService
        .createHtmlOutput(`
          <p>The following session${list.length > 1 ? 's were' : ' was'} updated:</p>
          <ul>
            <li>${list.join('</li><li>')}</li>
          </ul>
        ` + calendar)
        .setWidth(400)
        .setHeight(400);
      SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Schedule published');
    }
    else {
      const calendar = (
        project.metadata.calendar && project.metadata.calendar !== 'no'
      ) ? `<p>
        I triggered an update of the W3C calendar to propagate possible changes
        that I may have missed such as updates to session descriptions.
        </p>
        <p>
        Please allow a few minutes for the W3C calendar to get updated,
        and up to an hour for the schedule to reach the event's page on
        w3.org (if it exists).
        </p>` : '';
      const htmlOutput = HtmlService
        .createHtmlOutput(`
          <p>The schedule itself was already up-to-date,
          sessions did not need to be updated.</p>` +
          calendar
        )
        .setWidth(400)
        .setHeight(400);
      SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Nothing to update');
    }
    console.log('Report result... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}