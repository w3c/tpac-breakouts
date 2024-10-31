/**
 * Associate with GitHub repository
 */
export default function () {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const repository = spreadsheet.getDeveloperMetadata().find(data => data.getKey() === 'repository');
  const msg = repository ?
    `The spreadsheet is currently associated with the GitHub repository "${repository.getValue()}".
To change the association, please provide the new repository name below.` :
  'Please enter the GitHub repository that contains the TPAC/breakouts data, e.g. "w3c/tpac2024-breakouts".';
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Enter GitHub repository', msg, ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() == ui.Button.OK) {
    const value = response.getResponseText();
    // TODO: validate the entered repository somehow
    if (repository) {
      repository.setValue(value);
    }
    else {
      spreadsheet.addDeveloperMetadata('repository', value);
    }
  }
}