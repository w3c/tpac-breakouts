import associateWithGitHubRepository from './link-to-repository.mjs';
import reportError from './report-error.mjs';

/**
 * Trigger a GitHub workflow that refreshes the data from GitHub
 */
export default function () {
  const scriptProperties = PropertiesService.getScriptProperties();
  const GITHUB_TOKEN = scriptProperties.getProperty('GITHUB_TOKEN');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let repository = spreadsheet.getDeveloperMetadata().find(data => data.getKey() === 'repository');
  if (!repository) {
    associateWithGitHubRepository();
    repository = spreadsheet.getDeveloperMetadata().find(data => data.getKey() === 'repository');
    if (!repository) {
      return;
    }
  }
  const repo = repository.getValue();

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
    `https://api.github.com/repos/${repo}/actions/workflows/sync-spreadsheet.yml/dispatches`,
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