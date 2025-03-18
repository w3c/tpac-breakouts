import reportError from './lib/report-error.mjs';
import { getProject } from './lib/project.mjs';
import { exportMapping } from './lib/w3cid-map.mjs';

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

    console.log('Push the mapping table to the GitHub repository...');
    await exportMapping(project);
    console.log('Push the mapping table to the GitHub repository... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}