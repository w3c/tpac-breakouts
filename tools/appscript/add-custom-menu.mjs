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
        .addItem('Revalidate metadata / adopted schedule (after manual edits)', 'validateGrid')
        .addItem('Refresh list of registrants (Groups only)', 'fetchRegistrants')
        .addSubMenu(
          SpreadsheetApp.getUi()
            .createMenu('Export') 	
            .addItem('Export event info, rooms, days, slots (to GitHub)', 'exportMetadata')
            .addItem('Export event to files (to HTML, JSON)', 'exportEventToFiles')
            .addItem('Export emails of group chairs/team contacts (Groups only)', 'exportEmails')
        )
        .addSubMenu(
          SpreadsheetApp.getUi()
            .createMenu('Set up GitHub')
            .addItem('Create GitHub repository', 'createRepository')
            .addItem('Set authorization token (Groups only)', 'setAuthorizationToken')
        )	    
        .addSubMenu(
          SpreadsheetApp.getUi()
            .createMenu('Get backup from GitHub')
            .addItem('Recover published schedule (from GitHub)', 'importGrid')
            .addItem('Fetch event info, rooms, days, slots (from GitHub)', 'importMetadata')
        )
    )
    .addToUi();
}

