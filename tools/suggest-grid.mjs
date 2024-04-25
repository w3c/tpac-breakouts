#!/usr/bin/env node
/**
 * This tool suggests a grid that could perhaps work given known constraints.
 *
 * To run the tool:
 *
 *  npx suggest-grid [preservelist or all or none] [exceptlist or none] [apply] [seed]
 *
 * where [preservelist or all] is a comma-separated (no spaces) list of session
 * numbers whose assigned slots and rooms must be preserved. Or "all" to
 * preserve all slots and rooms that have already been assigned. Or "none" not
 * to preserve anything.
 * 
 * [exceptlist or none] only makes sense when the preserve list is "all" and
 * allows to specify a comma-separated (no spaces) list of session numbers whose
 * assigned slots and rooms are to be discarded. Or "none" to say "no exception,
 * preserve info in all sessions".
 * 
 * [apply] is "apply" if you want to apply the suggested grid on GitHub, or
 * a link to a changes file if you want to test changes to the suggested grid
 * before it gets validated and saved as an HTML page. The changes file must be
 * a file where each row starts with a session number, followed by a space,
 * followed by either a slot start time or a slot number or a room name. If slot
 * was specified, it may be followed by another space, followed by a room name.
 * (Room name cannot be specified before the slot).
 *
 * [seed] is the seed string to shuffle the array of sessions. How much
 * shuffling happens depends on other parameters which take
 * precedence (e.g., the preserve list).
 * 
 * Examples:
 *
 * To generate a grid leveraging constraints identified by the
 * session chairs (e.g., avoid conflicts with identified sessions):
 *   npx suggest-grid
 *
 * To generate a grid leveraging constraints identified by the
 * session chairs and also any hard-coded rooms or time slots in
 * the project:
 *   npx suggest-grid all
 *
 * To generate a grid leveraging constraints identified by the
 * session chairs and also any hard-coded rooms or time slots in
 * the project, except specifically ignoring what has been
 * hard-coded for sessions 6 and 14 (while leaving the Project intact):
 *   npx suggest-grid all 6,14
 * 
 * To generate a grid leveraging constraints identified by the
 * session chairs and also any hard-coded rooms or time slots in
 * the project, except [without modifying the project] trying out
 * a schedule achieved by swapping session times for sessions 7 and 9:
 *
 * 1) Create a file (e.g., changes.txt) that includes, for example:
 *    7 13:00
 *    9 14:00
 * 
 * 2) Run npx suggest-grid all none changes.txt
 * 
 *
 * To generate a grid that has been previously generated (ignoring
 * any hard-coded project information) with seed "dfwla":
 *
 * npx suggest-grid none none false dfwla
 *
 * Assumptions:
 * - All rooms are of equal quality
 * - Some slots may be seen as preferable
 *
 * Goals:
 * - Where possible, sessions that belong to the same track should take place
 * in the same room. Because a session may belong to two tracks, this is not
 * an absolute goal.
 * - Schedule sessions back-to-back to avoid gaps.
 * - Favor minimizing travels over using different rooms.
 * - Session issue number should not influence slot and room (early proponents
 * should not be favored or disfavored).
 * - Minimize the number of rooms used in parallel.
 * - Only one session labeled for a given track at the same time.
 * - Only one session with a given chair at the same time.
 * - No identified conflicting sessions at the same time.
 * - Meet duration preference.
 * - Meet capacity preference.
 *
 * The tool schedules as many sessions as possible, skipping over sessions that
 * it cannot schedule due to a confict that it cannot resolve.
 */

import { readFile } from 'fs/promises';
import { getEnvKey } from './lib/envkeys.mjs';
import { fetchProject, saveSessionMeetings } from './lib/project.mjs';
import { validateSession } from './lib/validate.mjs';
import { validateGrid } from './lib/validate.mjs';
import { convertProjectToHTML } from './lib/project2html.mjs';
import { parseMeetingsChanges,
         applyMeetingsChanges } from '../tools/lib/meetings.mjs';
import { suggestSchedule } from './lib/schedule.mjs';

const schedulingErrors = [
  'error: chair conflict',
  'error: group conflict',
  'error: scheduling',
  'error: irc',
  'error: meeting duplicate',
  'warning: capacity',
  'warning: conflict',
  'warning: duration',
  'warning: track'
];

/**
 * Helper function to generate a random seed
 */
function makeseed() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  return [1, 2, 3, 4, 5]
    .map(_ => chars.charAt(Math.floor(Math.random() * chars.length)))
    .join('');
}

async function main({ preserve, except, changesFile, apply, seed }) {
  const PROJECT_OWNER = await getEnvKey('PROJECT_OWNER', 'w3c');
  const PROJECT_NUMBER = await getEnvKey('PROJECT_NUMBER');
  const CHAIR_W3CID = await getEnvKey('CHAIR_W3CID', {}, true);
  console.warn();
  console.warn(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER}...`);
  const project = await fetchProject(PROJECT_OWNER, PROJECT_NUMBER);
  if (!project) {
    throw new Error(`Project ${PROJECT_OWNER}/${PROJECT_NUMBER} could not be retrieved`);
  }
  project.chairsToW3CID = CHAIR_W3CID;
  console.warn(`- found ${project.sessions.length} sessions`);
  await Promise.all(project.sessions.map(async session => {
    session.errors = await validateSession(session.number, project);
    session.blockingErrors = session.errors.filter(err =>
      err.severity === 'error' &&
      err.type !== 'chair conflict' &&
      err.type !== 'group conflict' &&
      err.type !== 'meeting duplicate' &&
      err.type !== 'scheduling' &&
      err.type !== 'irc');
    return session;
  }));
  const validSessions = project.sessions.filter(s => s.blockingErrors.length === 0);
  console.warn(`- found ${validSessions.length} valid sessions among them: ${validSessions.map(s => s.number).join(', ')}`);
  console.warn(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER} and session(s)... done`);

  // Prepare shuffle seed if needed
  seed = seed ?? makeseed();

  // Load changes to apply locally if so requested
  let changes = [];
  if (changesFile) {
    console.warn('Load changes file...');
    const yaml = await readFile(changesFile, 'utf8');
    changes = parseMeetingsChanges(yaml);
    console.warn(`- ${changes.length} changes detected`);
    console.warn('Load changes file... done');
  }

  // Save initial grid algorithm settings as CLI params
  const cli = {};
  if (preserve === 'all') {
    cli.preserve = 'all';
  }
  else if (!preserve || preserve.length === 0) {
    cli.preserve = 'none';
  }
  else {
    cli.preserve = preserve.join(',');
  }
  if (!except) {
    cli.except = 'none';
  }
  else if (except.length > 0) {
    cli.except = except.join(',');
  }
  else {
    cli.except = 'none';
  }
  cli.seed = seed;
  cli.apply = apply;
  cli.cmd = `npx suggest-grid ${cli.preserve} ${cli.except} ${apply} ${cli.seed}`;

  // Apply preserve/except parameters
  if (preserve === 'all') {
    preserve = project.sessions.filter(s => s.day || s.slot || s.room).map(s => s.number);
  }
  if (except) {
    preserve = preserve.filter(nb => !except.includes(nb));
  }
  if (!preserve) {
    preserve = [];
  }
  cli.preserveInPractice = ((preserve === 'all' || except) && preserve.length > 0) ?
    ' (in practice: ' + preserve.sort((n1, n2) => n1 - n2).join(',') + ')' :
    '';
  for (const session of validSessions) {
    if (!preserve.includes(session.number)) {
      for (const field of ['room', 'day', 'slot', 'meeting']) {
        if (session[field]) {
          delete session[field];
          session.updated = true;
        }
      }
    }
  }

  // Consider that default capacity is "average number of people" to avoid assigning
  // sessions to too small rooms
  for (const session of project.sessions) {
    if (session.description?.capacity === 0) {
      session.description.capacity = 24;
    }
  }

  await suggestSchedule(project, { seed });

  for (const session of validSessions) {
    // TODO: make sure that "session.meetings" was set
    if (session.meetings.length === 0 ||
        session.meetings.find(m => !(m.room && m.day && m.slot))) {
      const tracks = session.tracks.length ? ' - ' + session.tracks.join(', ') : '';
      console.warn(`- [WARNING] #${session.number} could not be fully scheduled${tracks}`);
    }
  }

  if (changes.length > 0) {
    console.warn();
    console.warn(`Apply local changes...`);
    applyMeetingsChanges(project.sessions, changes);
    console.warn(`Apply local changes... done`);
  }

  console.warn();
  console.warn(`Validate grid...`);
  const errors = (await validateGrid(project))
    .filter(error => schedulingErrors.includes(`${error.severity}: ${error.type}`));
  if (errors.length) {
    for (const error of errors) {
      console.warn(`- [${error.severity}: ${error.type}] #${error.session}: ${error.messages.join(', ')}`);
    }
  }
  else {
    console.warn(`- looks good!`);
  }
  console.warn(`Validate grid... done`);

  cli.preserveInPractice = (preserve !== 'all' && preserve.length > 0) ?
    ' (in practice: ' + preserve.sort((n1, n2) => n1 - n2).join(',') + ')' :
    '';
  const html = await convertProjectToHTML(project, cli);
  console.warn();
  console.log(html);

  console.warn();
  console.warn('To re-generate the grid, run:');
  console.warn(cli.cmd);

  if (apply) {
    console.warn();
    const sessionsToUpdate = project.sessions.filter(s => s.updated);
    for (const session of sessionsToUpdate) {
      console.warn(`- updating #${session.number}...`);
      await saveSessionMeetings(session, project);
      console.warn(`- updating #${session.number}... done`);
    }
  }
}


// Read preserve list from command-line
let preserve;
if (process.argv[2]) {
  if (!process.argv[2].match(/^all|none|\d+(,\d+)*$/)) {
    console.warn('Command needs to receive a list of issue numbers as first parameter or "all"');
    process.exit(1);
  }
  if (process.argv[2] === 'all') {
    preserve = 'all';
  }
  else if (process.argv[2] === 'none') {
    preserve = [];
  }
  else {
    preserve = process.argv[2].split(',').map(n => parseInt(n, 10));
  }
}

// Read except list
let except;
if (process.argv[3]) {
  if (!process.argv[3].match(/^none|\d+(,\d+)*$/)) {
    console.warn('Command needs to receive a list of issue numbers as second parameter or "none"');
    process.exit(1);
  }
  except = process.argv[3] === 'none' ?
    undefined :
    process.argv[3].split(',').map(n => parseInt(n, 10));
}

const apply = process.argv[4] === 'apply';
const changesFile = (apply || !process.argv[4] || !process.argv[4].match(/\./)) ?
  undefined :
  process.argv[4];
const seed = process.argv[5] ?? undefined;

main({ preserve, except, changesFile, apply, seed })
  .catch(err => {
    console.warn(`Something went wrong: ${err.message}`);
    throw err;
  });
