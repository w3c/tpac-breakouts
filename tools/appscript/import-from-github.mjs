import { getProject } from './project.mjs';
import reportError from './report-error.mjs';

/**
 * Trigger a GitHub workflow that refreshes the data from GitHub
 */
export default function () {
  const project = getProject(SpreadsheetApp.getActiveSpreadsheet());

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

  const options = {
    method : 'post',
    contentType: 'application/json',
    payload : JSON.stringify({
      ref: 'main',
      inputs: {
        sheet: spreadsheet.getId()
      }
    }),
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/actions/workflows/sync-spreadsheet.yml/dispatches`,
    options);
  const status = response.getResponseCode();
  if (status === 200 || status === 204) {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'Patience...',
      `A job was scheduled to refresh the data in the spreadsheet. This may take a while...

The job will clear the grid in the process. Please run "Generate grid" again once the grid is empty.`,
      ui.ButtonSet.OK
    );
  }
  else {
    reportError(`Unexpected HTTP status ${status} received from GitHub.

Data could not be imported from ${repo}.`);
  }
}