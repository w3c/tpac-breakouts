import { getProject } from './project.mjs';
import { fillGridSheet } from './schedule.mjs';
import reportError from './report-error.mjs';

/**
 * Generate the grid for the current spreadsheet
 */
export default function () {
  return generateGrid(SpreadsheetApp.getActiveSpreadsheet());
}


/**
 * Generate the grid in the provided spreadsheet
 */
function generateGrid(spreadsheet) {
  try {
    console.log('Read data from spreadsheet...');
    const project = getProject(spreadsheet);
    if (!project.sheets.sessions.sheet) {
      reportError('No sheet found that contains the list of sessions, please import data from GitHub first.');
      return;
    }
    console.log('Read data from spreadsheet... done');

    console.log('Generate grid sheet...');
    fillGridSheet(spreadsheet, project);
    console.log('Generate grid sheet... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}
