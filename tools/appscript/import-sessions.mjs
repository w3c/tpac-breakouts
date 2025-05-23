import reportError from './lib/report-error.mjs';
import importFromGitHub from './lib/import-from-github.mjs';

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
        <p><strong>Note:</strong> The import did not
	  affect existing schedule information (day, slot, room)
	  in the spreadsheet. In general, you should not have
	  to import schedule information from GitHub, but if you do,
	  that option is available in the "Advanced" menu.
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
