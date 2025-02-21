/**
 * Add a custom "TPAC" menu.
 *
 * The function is triggered when a user opens a spreadsheet.
 */
export default function () {
  SpreadsheetApp.getUi().createMenu('TPAC')
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('Event schedule grid')
        .addItem('Refresh the grid view', 'generateGrid')
        .addItem('Validate the grid', 'validateGrid')
        .addSeparator()
        .addItem('Propose a new grid', 'proposeGrid')
        .addSeparator()
        .addItem('Publish the grid', 'exportGrid')
        .addSeparator()
        .addItem('Fetch published grid from GitHub', 'importGrid')
    )
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('Event sessions')
        .addItem('Fetch the list of sessions from GitHub', 'importSessions')
    )
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('Event info, rooms, days, slots')
        .addItem('Fetch event info, rooms, days, slots from GitHub', 'importMetadata')
        /*.addSeparator()
        .addItem('Export event info, rooms, days, slots to GitHub', 'exportMetadata')*/
    )
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('Advanced')
        .addItem('Dump event data as JSON', 'exportEventData')
    )
    .addToUi();
}

