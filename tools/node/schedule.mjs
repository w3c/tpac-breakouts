import { readFile } from 'fs/promises';
import { convertProjectToHTML } from '../common/project2html.mjs';
import { saveSessionMeetings } from '../common/project.mjs';
import { parseMeetingsChanges, applyMeetingsChanges } from './lib/meetings.mjs';
import { validateGrid } from '../common/validate.mjs';
import { suggestSchedule } from '../common/schedule.mjs';
import { Srand } from '../common/jsrand.mjs';

export default async function (project, options) {
  console.warn();
  console.warn(`Validate sessions...`);
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
  console.warn(`- found ${validSessions.length} valid sessions among them: ${validSessions.map(s => s.number).join(', ')}`);
  console.warn(`Validate sessions... done`);

  // Prepare shuffle seed if needed
  options.seed = options.seed ?? (new Srand()).seed();

  // Load changes to apply locally if so requested
  let changes = [];
  if (options.changes) {
    console.warn('Load changes file...');
    const yaml = await readFile(options.changes, 'utf8');
    changes = parseMeetingsChanges(yaml);
    console.warn(`- ${changes.length} changes detected`);
    console.warn('Load changes file... done');
  }

  // Save initial grid algorithm settings as CLI params
  const cli = {};
  if (options.preserve?.includes('all')) {
    cli.preserve = 'all';
  }
  else if (options.preserve?.includes('none')) {
    cli.preserve = 'none';
  }
  else {
    cli.preserve = options.preserve.join(' ');
  }
  if (!options.except) {
    cli.except = 'none';
  }
  else if (options.except.length > 0) {
    cli.except = options.except.join(' ');
  }
  else {
    cli.except = 'none';
  }
  cli.seed = options.seed;
  cli.apply = options.apply;
  cli.reduce = options.reduce;  
  cli.cmd = `npx tpac-breakouts schedule --preserve ${cli.preserve} --except ${cli.except} --seed ${cli.seed}${cli.apply ? ' --apply' : ''}${cli.reduce ? ' --reduce' : ''}`;

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
  cli.preserveInPractice =
    ((preserveAll || options.except) && options.preserve.length > 0) ?
      ' (in practice: ' + options.preserve.sort((n1, n2) => n1 - n2).join(',') + ')' :
      '';
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

  // Consider that default capacity is "average number of people" to avoid assigning
  // sessions to too small rooms
  for (const session of project.sessions) {
    if (session.description?.capacity === 0) {
      session.description.capacity = 24;
    }
  }

  await suggestSchedule(project, { seed: options.seed });

  for (const session of validSessions) {
    if (session.meetings.length === 0 ||
        session.meetings.find(m => !(m.room && m.day && m.slot))) {
      const tracks = session.labels
        .filter(label => label.startsWith('track: '))
        .map(label => label.substring('track: '.length));
      const tracksStr = tracks.length ? ' - ' + tracks.join(', ') : '';
      console.warn(`- [WARNING] #${session.number} could not be fully scheduled${tracksStr}`);
    }
  }

  if (changes.length > 0) {
    console.warn();
    console.warn(`Apply local changes...`);
    applyMeetingsChanges(project.sessions, changes);
    console.warn(`Apply local changes... done`);
  }

  console.warn();
  console.warn(`Validate created grid...`);
  const { errors: newErrors } = await validateGrid(project, { what: 'scheduling' })
  if (newErrors.length) {
    for (const error of newErrors) {
      console.warn(`- [${error.severity}: ${error.type}] #${error.session}: ${error.messages.join(', ')}`);
    }
  }
  else {
    console.warn(`- looks good!`);
  }
  console.warn(`Validate created grid... done`);

  const html = await convertProjectToHTML(project, cli);
  console.warn();
  console.log(html);

  console.warn();
  console.warn('To re-generate the grid, run:');
  console.warn(cli.cmd);

  if (options.apply) {
    console.warn();
    console.warn(`Apply created grid...`);
    const sessionsToUpdate = project.sessions.filter(s => s.updated);
    for (const session of sessionsToUpdate) {
      console.warn(`- updating #${session.number}...`);
      await saveSessionMeetings(session, project);
      console.warn(`- updating #${session.number}... done`);
    }
    console.warn(`Apply created grid... done`);
  }
}
