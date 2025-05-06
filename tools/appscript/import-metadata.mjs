import reportError from './lib/report-error.mjs';
import importFromGitHub from './lib/import-from-github.mjs';

export default async function () {
  try {
    const githubProject = await importFromGitHub('metadata');

    console.log('Report result...');
    const htmlOutput = HtmlService
      .createHtmlOutput(`
        <p>Spreadsheet updated with metadata info from GitHub:</p>
        <ul>
          <li><b>${githubProject.rooms.length}</b> rooms</li>
          <li><b>${githubProject.slots.length}</b> slots</li>
        </ul>
      `)
      .setWidth(300)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Event info updated');
    console.log('Report result... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}
