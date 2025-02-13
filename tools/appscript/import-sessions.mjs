import reportError from './report-error.mjs';
import importFromGitHub from './import-from-github.mjs';

/**
 * Trigger a GitHub workflow that refreshes the data from GitHub
 */
export default async function () {
  try {
    const githubProject = await importFromGitHub('sessions');

    console.log('Report result...');
    const htmlOutput = HtmlService
      .createHtmlOutput(`
        <p>
          <b>${githubProject.sessions.length}</b>
          sessions retrieved from GitHub.
        </p>
      `)
      .setWidth(300)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Sessions updated');
    console.log('Report result... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}
