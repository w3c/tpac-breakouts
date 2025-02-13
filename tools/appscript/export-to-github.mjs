import { getProject } from './project.mjs';
import reportError from './report-error.mjs';
import { fetchProjectFromGitHub, saveSessionMeetings } from '../common/project.mjs';


/**
 * Trigger a GitHub workflow that refreshes the data from GitHub
 */
export default async function () {
  // TODO: consider reading only the list of sessions
  console.log('Read data from spreadsheet...');
  const project = getProject(SpreadsheetApp.getActiveSpreadsheet());
  console.log('Read data from spreadsheet... done');

  if (!project.metadata.reponame) {
    reportError(`No GitHub repository associated with the current document.

Make sure that the "GitHub repository name" parameter is set in the "Event" sheet.

Also make sure the targeted repository and project have been properly initialized.
If not, ask François or Ian to run the required initialization steps.`);
  }

  const repoparts = project.metadata.reponame.split('/');
  const repo = {
    owner: repoparts.length > 1 ? repoparts[0] : 'w3c',
    name: repoparts.length > 1 ? repoparts[1] : repoparts[0]
  };

  try {
    console.log('Fetch data from GitHub...');
    const githubProject = await fetchProjectFromGitHub(
      repo.owner === 'w3c' ? repo.owner : `user/${repo.owner}`,
      repo.name,
      null
    );
    console.log('Fetch data from GitHub... done');

    console.log('Export updates when needed...');
    const updated = [];
    for (const session of githubProject.sessions) {
      const ssSession = project.sessions.find(s =>
        s.number === session.number);
      if (!ssSession) {
        const htmlOutput = HtmlService
          .createHtmlOutput(`
            <p>Sorry, I did not export anything because I detected a new
            session in the GitHub repository that is not in the spreadsheet yet:
            </p>
            <blockquote>
              <p>${session.title}
              (<a href="https://github.com/${session.repository}/issues/${session.number}">#${session.number}</a>)
              </p>
            </blockquote>
            <p>Please run <b>TPAC > Sync with GitHub > Import data from GitHub</b>
            first to retrieve it.
            You may also want to re-validate the grid afterwards!</p>`
          )
          .setWidth(400)
          .setHeight(400);
        SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Not up-to-date!');
        return;
      }

      // TODO: handle meeting column for TPAC group meetings

      if ((session.room !== ssSession.room) ||
          (session.day !== ssSession.day) ||
          (session.slot !== ssSession.slot)) {
        console.warn(`- updating #${session.number}...`);
        session.room = ssSession.room;
        session.day = ssSession.day;
        session.slot = ssSession.slot;
        await saveSessionMeetings(session, githubProject);
        updated.push(session);
        console.warn(`- updating #${session.number}... done`);
      }
    }
    console.log('Export updates when needed... done');

    // Report the list of sessions that were updated
    console.log('Report result...');
    if (updated.length > 0) {
      const list = updated.map(s =>
        `${s.title} (<a href="https://github.com/${s.repository}/issues/${s.number}">#${s.number}</a>)`);
      const htmlOutput = HtmlService
        .createHtmlOutput(`
          <p>The following session${list.length > 1 ? 's were' : ' was'} updated:</p>
          <ul>
            <li>${list.join('</li><li>')}</li>
          </ul>
        `)
        .setWidth(400)
        .setHeight(400);
      SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Updated');
    }
    else {
      const htmlOutput = HtmlService
        .createHtmlOutput(`
          <p>Data seems up-to-date already, nothing to export!</p>`
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