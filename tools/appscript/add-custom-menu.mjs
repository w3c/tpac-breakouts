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
        .createMenu('Manage the schedule')
        .addItem('Validate metadata and existing schedule', 'validateGrid')
        .addItem('Validate metadata and propose a new schedule', 'proposeGrid')
        .addItem('Apply current schedule sheet', 'applySchedule')
        .addItem('Refresh table view of schedule', 'generateGrid')
    )
    .addItem('Publish the schedule and calendar', 'exportGrid')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('Advanced')
        .addItem('Retrieve latest published schedule (from GitHub)', 'importGrid')
        .addItem('Fetch event info, rooms, days, slots (from GitHub)', 'importMetadata')
        .addItem('Export event to files (HTML, JSON)', 'exportEventToFiles')
        .addItem('Push the global W3C IDs spreadsheet (to GitHub)', 'exportW3CMap')
        /*.addItem('Export event info, rooms, days, slots to GitHub', 'exportMetadata')*/
    )
    .addToUi();
}

