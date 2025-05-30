import reportError from './lib/report-error.mjs';
import { getProject, saveSessionValidationInSheet } from './lib/project.mjs';
import { fillGridSheet } from './lib/schedule.mjs';
import { fetchMapping } from './lib/w3cid-map.mjs';
import { validateGrid } from '../common/validate.mjs';


export default async function () {
  try {
    console.log('Read data from spreadsheet...');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const project = getProject(spreadsheet);
    project.w3cIds = await fetchMapping();
    console.log('Read data from spreadsheet... done');

    console.log('Validate the grid...');
    const res = await validateGrid(project, { what: 'everything' });
    console.log('Validate the grid... done');

    console.warn(`Save validation results...`);
    for (const change of res.changes) {
      console.warn(`- save changes for session ${change.number}`);
      const session = project.sessions.find(s => s.number === change.number);
      session.validation.error = change.validation.error;
      session.validation.warning = change.validation.warning;
      session.validation.check = change.validation.check;
      await saveSessionValidationInSheet(session, project);
    }
    SpreadsheetApp.flush();
    console.warn(`Save validation results... done`);

    console.log('Refresh grid view with validation results...');
    fillGridSheet(spreadsheet, project, res.errors);
    console.log('Refresh grid view with validation results... done');

    console.log('Report validation results...');
    const htmlOutput = HtmlService
      .createHtmlOutput(
        '<pre>' + JSON.stringify(res.changes, null, 2) + '</pre>'
      )
      .setWidth(300)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Validation report');
    console.log('Report validation results... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}