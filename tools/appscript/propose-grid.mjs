import { getProject } from './project.mjs';
import { fillGridSheet } from './schedule.mjs';
import { suggestSchedule } from '../common/schedule.mjs';
import reportError from './report-error.mjs';
import { validateGrid } from '../common/validate.mjs';

/**
 * Generate the grid for the current spreadsheet
 */
export default function () {
  return proposeGrid(SpreadsheetApp.getActiveSpreadsheet());
}


/**
 * Generate the grid in the provided spreadsheet
 */
async function proposeGrid(spreadsheet) {
  try {
    console.log('Read data from spreadsheet...');
    const project = getProject(spreadsheet);
    if (!project.sheets.sessions.sheet) {
      reportError('No sheet found that contains the list of sessions, please import data from GitHub first.');
      return;
    }
    console.log('Read data from spreadsheet... done');

    console.log('Prompt user...');
    console.log('- TODO: prompt user for confirmation and parameters');
    const options = {};
    console.log('Prompt user... done');

    console.log(`Validate sessions...`);
    let { errors } = await validateGrid(project);
    errors = errors.filter(error =>
      error.severity === 'error' &&
      error.type !== 'chair conflict' &&
      error.type !== 'group conflict' &&
      error.type !== 'meeting duplicate' &&
      error.type !== 'scheduling' &&
      error.type !== 'irc');
    const validSessions = project.sessions.filter(s =>
      !errors.find(error => error.number === s.number));
    project.sessions
      .filter(s => errors.find(error => error.number === s.number))
      .forEach(s => s.blockingError = true);
    console.log(`- found ${validSessions.length} valid sessions among them: ${validSessions.map(s => s.number).join(', ')}`);
    console.log(`Validate sessions... done`);

    console.log(`Prepare parameters...`);
    // Prepare shuffle seed if needed
    options.seed = options.seed ?? makeseed();

    // Apply preserve/except parameters
    const preserveAll = options.preserve?.includes('all');
    if (preserveAll) {
      options.preserve = project.sessions
        .filter(s => s.meeting || s.day || s.slot || s.room)
        .map(s => s.number);
    }
    if (options.except) {
      options.preserve = options.preserve
        .filter(nb => !options.except.includes(nb));
    }
    if (!options.preserve) {
      options.preserve = [];
    }
    for (const session of validSessions) {
      if (!options.preserve.includes(session.number)) {
        for (const field of ['room', 'day', 'slot', 'meeting']) {
          if (session[field]) {
            delete session[field];
            session.updated = true;
          }
        }
      }
    }

    // Consider that default capacity is "average number of people"
    // to avoid assigning sessions to too small rooms
    for (const session of project.sessions) {
      if (session.description?.capacity === 0) {
        session.description.capacity = 24;
      }
    }
    console.log(`Prepare parameters... done`);

    console.log(`Compute new grid...`);
    await suggestSchedule(project, { seed: options.seed });
    for (const session of validSessions) {
      // TODO: make sure that "session.meetings" was set
      if (session.meetings.length === 0 ||
          session.meetings.find(m => !(m.room && m.day && m.slot))) {
        const tracks = session.tracks.length ? ' - ' + session.tracks.join(', ') : '';
        console.warn(`- #${session.number} could not be fully scheduled${tracks}`);
      }
    }
    console.log(`Compute new grid... done`);

    console.log(`Validate new grid...`);
    const { errors: newErrors } = await validateGrid(project, { what: 'scheduling' })
    if (newErrors.length) {
      for (const error of newErrors) {
        console.warn(`- [${error.severity}: ${error.type}] #${error.session}: ${error.messages.join(', ')}`);
      }
    }
    else {
      console.log(`- looks good!`);
    }
    console.warn(`Validate new grid... done`);

    console.log('Report new grid in grid sheet...');
    fillGridSheet(spreadsheet, project, newErrors);
    console.log('Report new grid in grid sheet... done');

    console.log('Report results to user...');
    console.log('- TODO: report something meaningful');
    const htmlOutput = HtmlService
      .createHtmlOutput(
        '<pre>' + JSON.stringify(newErrors, null, 2) + '</pre>'
      )
      .setWidth(300)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Validation report');
    console.log('Report results to user... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}


/**
 * Helper function to generate a random seed
 */
function makeseed() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  return [1, 2, 3, 4, 5]
    .map(_ => chars.charAt(Math.floor(Math.random() * chars.length)))
    .join('');
}
