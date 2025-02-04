/**
 * Add a custom "TPAC" menu.
 *
 * The function is triggered when a user opens a spreadsheet.
 */
export default function () {
  SpreadsheetApp.getUi().createMenu('TPAC')
    .addItem('Refresh grid', 'generateGrid')
    .addItem('Validate grid', 'validateGrid')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('Sync with GitHub')
        .addItem('Import data from GitHub', 'importFromGitHub')
        .addItem('Export data to GitHub', 'exportToGitHub')
        .addItem('Export event data as JSON', 'exportEventData')
    )
    .addToUi();
}

