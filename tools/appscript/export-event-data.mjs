import { getProject } from './project.mjs';

/**
 * Export the event data as JSON
 */
export default function () {
  const project = getProject(SpreadsheetApp.getActiveSpreadsheet());

  const htmlOutput = HtmlService
    .createHtmlOutput(
      '<pre>' + JSON.stringify(project, null, 2) + '</pre>'
    )
    .setWidth(300)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Event data');
}