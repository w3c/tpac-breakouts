import { getProject } from './lib/project.mjs';
import { fillGridSheet } from './lib/schedule.mjs';
import reportError from './lib/report-error.mjs';
import { fetchMapping } from './lib/w3cid-map.mjs';
import { validateGrid } from '../common/validate.mjs';

/**
 * Generate the grid for the current spreadsheet
 */
export default function () {
  return generateGrid(SpreadsheetApp.getActiveSpreadsheet());
}


/**
 * Generate the grid in the provided spreadsheet
 */
async function generateGrid(spreadsheet) {
  try {
    console.log('Read data from spreadsheet...');
    const project = getProject(spreadsheet);
    project.w3cIds = await fetchMapping();
    if (!project.sheets.sessions.sheet) {
      reportError('No sheet found that contains the list of sessions, please import data from GitHub first.');
      return;
    }
    console.log('Read data from spreadsheet... done');

    console.log('Validate the grid...');
    const res = await validateGrid(project, { what: 'everything' });
    console.log('Validate the grid... done');

    console.log('Generate grid sheet...');
    fillGridSheet(spreadsheet, project, res.errors);
    console.log('Generate grid sheet... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}
