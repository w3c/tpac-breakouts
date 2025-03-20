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
        .createMenu('Schedule sessions/groups')
        .addItem('Propose schedule (to new sheet)', 'proposeGrid')
        .addItem('Adopt schedule (on current sheet)', 'applySchedule')
    )
    .addItem('Publish adopted schedule and calendar', 'exportGrid')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('Advanced')
        .addItem('Validate metadata and existing schedule', 'validateGrid')
        .addItem('Retrieve latest published schedule (from GitHub)', 'importGrid')
        .addItem('Fetch event info, rooms, days, slots (from GitHub)', 'importMetadata')
        .addItem('Export event info, rooms, days, slots (to GitHub)', 'exportMetadata')
        .addItem('Export event to files (HTML, JSON)', 'exportEventToFiles')
    )
    .addToUi();
}

