/**
 * Add a custom "Event" menu.
 *
 * The function is triggered when a user opens a spreadsheet.
 */
export default function () {
  SpreadsheetApp.getUi()
    .createMenu('Event')
    .addItem('Refresh sessions/groups (from GitHub)', 'importSessions')
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('Manage the grid')
        .addItem('Propose a new grid', 'proposeGrid')
        .addItem('Refresh the grid view', 'generateGrid')
        .addItem('Validate the grid', 'validateGrid')
    )
    .addItem('Publish the grid and calendar', 'exportGrid')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('Advanced')
        .addItem('Retrieve latest published grid (from GitHub)', 'importGrid')
        .addItem('Fetch event info, rooms, days, slots (from GitHub)', 'importMetadata')
        /*.addItem('Export event info, rooms, days, slots to GitHub', 'exportMetadata')*/
        .addItem('Dump event data as JSON', 'exportEventData')
    )
    .addToUi();
}

