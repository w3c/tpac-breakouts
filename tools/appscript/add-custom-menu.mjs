/**
 * Add a custom "TPAC" menu.
 *
 * The function is triggered when a user opens a spreadsheet.
 */
export default function () {
  SpreadsheetApp.getUi().createMenu('TPAC')
    .addItem('Associate with GitHub repository', 'associateWithGitHubRepository')
    .addItem('Import data from GitHub', 'importFromGithub')
    .addItem('Generate grid', 'generateGrid')
    .addToUi();
}

