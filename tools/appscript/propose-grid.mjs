import reportError from './lib/report-error.mjs';
import { getProject } from './lib/project.mjs';
import { fillGridSheet } from './lib/schedule.mjs';
import { fetchMapping } from './lib/w3cid-map.mjs';
import { suggestSchedule } from '../common/schedule.mjs';
import { validateGrid } from '../common/validate.mjs';
import { Srand } from '../common/jsrand.mjs';


export default function () {
  return proposeGrid(SpreadsheetApp.getActiveSpreadsheet());
}


async function proposeGrid(spreadsheet) {
  try {
    console.log('Read data from spreadsheet...');
    const project = getProject(spreadsheet);
    project.w3cIds = await fetchMapping();
    if (!project.sheets.sessions.sheet) {
      reportError('No sheet found that contains the list of sessions, please import data from GitHub first.');
      return;
    }
    console.log('Read data from spreadsheet... done');

    console.log('Prompt user...');
    console.log('- TODO: prompt user for confirmation and parameters');
    const options = {
      preserve: ['all']
    };
    console.log('Prompt user... done');

    console.log(`Validate sessions...`);
    let { errors, changes } = await validateGrid(project);
    errors = errors.filter(error =>
      error.severity === 'error' &&
      error.type !== 'chair conflict' &&
      error.type !== 'group conflict' &&
      error.type !== 'meeting duplicate' &&
      error.type !== 'scheduling' &&
      error.type !== 'irc');
    const validSessions = project.sessions.filter(s =>
      !errors.find(error => error.session === s.number));
    const invalidSessions = project.sessions.filter(s =>
      errors.find(error => error.session === s.number));
    project.sessions
      .filter(s => errors.find(error => error.session === s.number))
      .forEach(s => s.blockingError = true);
    console.log(`- found ${validSessions.length} valid sessions among them: ${validSessions.map(s => s.number).join(', ')}`);
    console.log(`Validate sessions... done`);

    console.log(`Prepare parameters...`);
    // Prepare shuffle seed if needed
    options.seed = options.seed ?? (new Srand()).seed();

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
    let noschedule = [];
    await suggestSchedule(project, { seed: options.seed });
    for (const session of validSessions) {
      // TODO: make sure that "session.meetings" was set
      if (!session.meetings ||
          session.meetings.length === 0 ||
          session.meetings.find(m => !(m.room && m.day && m.slot))) {
        const tracks = session.labels
          .filter(label => label.startsWith('track: '))
          .map(label => label.substring('track: '.length));
        const tracksStr = tracks.length ? ' - ' + tracks.join(', ') : '';
        noschedule.push(`${session.title} (#${session.number}${tracksStr})`);
        console.warn(`- ${noschedule[noschedule.length - 1]} could not be fully scheduled`);
      }
    }
    console.log(`Compute new grid... done`);

    console.log(`Validate new grid...`);
    let { errors: newErrors, changes: newChanges } = await validateGrid(project, { what: 'scheduling' })
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
    if (invalidSessions.length > 0) {
      newErrors = invalidSessions
        .map(s => errors.filter(error => error.session === s.number))
        .flat()
        .concat(newErrors);
    }
    if (noschedule.length > 0) {
      newErrors = validSessions
        .filter(session =>
          !session.meetings ||
          session.meetings.length === 0 ||
          session.meetings.find(m => !(m.room && m.day && m.slot)))
        .map(session => Object.assign({
          severity: 'error',
          type: 'conflict',
          session: session.number,
          messages: ['Session could not be scheduled due to unresolvable conflicts']
        }))
        .concat(newErrors);
    }
    fillGridSheet(spreadsheet, project, newErrors);
    console.log('Report new grid in grid sheet... done');

    console.log('Report results to user...');
    let msg = `<p>Spreadsheet updated with a new schedule proposal.</p>`;
    if (invalidSessions.length > 0) {
      msg += `<p>
          I could not schedule the following sessions because they are invalid:
        </p>
        <ul>` +
        invalidSessions.map(s => `<li>${s.title} (#${s.number})</li>`).join('\n') +
        `</ul>`;
    }
    if (noschedule.length > 0) {
      msg += `<p>
        I could not schedule the following sessions due to conflicts:
        </p>
        <ul>` +
        noschedule.map(err => `<li>${err}</li>`).join('\n') +
        `</ul>`;
    }
    if (newErrors.length > 0) {
      msg += `<p>
        I did not manage to avoid the following problems:
        </p>
        <ul>` +
        newErrors.map(err => `<li>[${err.severity}: ${err.type}] #${err.session}: ${err.messages.join(', ')}</li>`).join('\n') +
      `</ul>
      <p>See the Grid validation sheet for details.</p>`;
    }
    const htmlOutput = HtmlService
      .createHtmlOutput(msg)
      .setWidth(300)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'New schedule grid');
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
  return Math.floor(Math.random() * 1000000);
}
