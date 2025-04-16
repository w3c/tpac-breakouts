import reportError from './lib/report-error.mjs';
import { getProject } from './lib/project.mjs';
import { exportMapping } from './lib/w3cid-map.mjs';
import { getEnvKey } from '../common/envkeys.mjs';
import { parseRepositoryName } from '../common/repository.mjs';
import {
  fetchProjectFromGitHub,
  exportProjectToGitHub
} from '../common/project.mjs';


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

    const repo = parseRepositoryName(project.metadata.reponame);

    console.log('Fetch data from GitHub...');
    const githubProject = await fetchProjectFromGitHub(
      project.metadata.reponame, null);
    console.log('Fetch data from GitHub... done');

    console.log('Check consistency with GitHub...');
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
    }
    console.log('Check consistency with GitHub... done');

    console.log('Export project to GitHub...');
    await exportProjectToGitHub(project, { what: 'all' });
    console.log('Export project to GitHub... done');

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
    const calendar = (
      project.metadata.calendar &&
      project.metadata.calendar !== 'no'
    ) ? `
      <p>
        Please allow a few minutes for the W3C calendar to get updated,
        and up to an hour for the schedule to reach the event's page on
        w3.org (if it exists).
        </p>
      ` : `
      <p>
        The W3C calendar will <b>not</b> be updated. If you would like to
        propagate the schedule to the W3C calendar, please update the value of
        the "Sync with W3C calendar" setting in the "Event" sheet to "draft",
        "tentative", or "confirmed", and run the publication again.
      </p>`;
    const htmlOutput = HtmlService
      .createHtmlOutput(`
        <p>
          The adopted schedule has successfully been published to GitHub.
        </p>` +
        calendar
      )
      .setWidth(400)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Schedule published');
    console.log('Report result... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}