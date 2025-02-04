import { getProject } from './project.mjs';
import { validateGrid } from '../common/validate.mjs';

/**
 * Export the event data as JSON
 */
export default async function () {
  const project = getProject(SpreadsheetApp.getActiveSpreadsheet());

  const res = await validateGrid(project, { what: 'everything' });

  const htmlOutput = HtmlService
    .createHtmlOutput(
      '<pre>' + JSON.stringify(res, null, 2) + '</pre>'
    )
    .setWidth(300)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Validation result');
}