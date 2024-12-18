import { getProject } from './project.mjs';

/**
 * Export the event data as JSON
 */
export default function () {
  const project = getProject(SpreadsheetApp.getActiveSpreadsheet());

  const ui = SpreadsheetApp.getUi();
    ui.alert(
      'Event data',
      JSON.stringify(project, null, 2),
      ui.ButtonSet.OK
    );
}