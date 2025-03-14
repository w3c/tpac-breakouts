import reportError from './lib/report-error.mjs';
import importFromGitHub from './lib/import-from-github.mjs';

/**
 * Trigger a GitHub workflow that refreshes the data from GitHub
 */
export default async function () {
  try {
    const githubProject = await importFromGitHub('grid');

    console.log('Report result...');
    console.log('- TODO: say what got updated');
    const htmlOutput = HtmlService
      .createHtmlOutput(`
        <p>Schedule imported from GitHub.</p>
      `)
      .setWidth(300)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Schedule imported');
    console.log('Report result... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}