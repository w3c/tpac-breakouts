/**
 * Add a custom "TPAC" menu.
 *
 * The function is triggered when a user opens a spreadsheet.
 */
export default function () {
  SpreadsheetApp.getUi().createMenu('TPAC')
    .addItem('Export event data as JSON', 'exportEventData')
    .addItem('Import data from GitHub', 'importFromGithub')
    .addItem('Generate grid', 'generateGrid')
    .addToUi();
}

