import reportError from './report-error.mjs';
import { getProject } from './project.mjs';
import { validateGrid } from '../common/validate.mjs';

/**
 * Export the event data as JSON
 */
export default async function () {
  try {
    console.log('Read data from spreadsheet...');
    const project = getProject(SpreadsheetApp.getActiveSpreadsheet());
    if ((project.metadata.type === 'tpac-breakouts') ||
        (project.metadata.type === 'breakouts-day')) {
      // Only two types of events from an internal perspective
      project.metadata.type = 'breakouts';
    }
    console.log('Read data from spreadsheet... done');

    console.log('Validate the grid...');
    const res = await validateGrid(project, { what: 'everything' });
    console.log('Validate the grid... done');

    console.log('Refresh grid view, with validation result...');
    console.log('- TODO: re-generate grid');
    console.log('- TODO: report validation result');
    console.log('Refresh grid view, with validation result... done');

    console.log('Report validation result...');
    const htmlOutput = HtmlService
      .createHtmlOutput(
        '<pre>' + JSON.stringify(res, null, 2) + '</pre>'
      )
      .setWidth(300)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Validation result');
    console.log('Report validation result... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}