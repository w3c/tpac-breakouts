import { getEnvKey } from '../common/envkeys.mjs';
import { synchronizeSessionWithCalendar } from '../common/calendar.mjs';
import { validateSession, validateGrid } from '../common/validate.mjs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms, 'slept'));
}

export default async function (project, number, options) {
  const sessionToSynchronize =
    (number.trim().toLowerCase() === 'all') ?
      'all' :
      (number.trim().match(/^\d+$/)?.[0] ?? null);
  if (sessionToSynchronize === null) {
    throw new Error(`Invalid argument passed as parameter. Expected "all" or a session number and got "${number}"`);
  }

  if (options.status?.toLowerCase() === 'no' ||
      !project.metadata.calendar ||
      project.metadata.calendar.toLowerCase() === 'no') {
    console.warn('Nothing to do, synchronization with W3C calendar is disabled. To enable synchronization, set the `--status` command-line option or the "calendar" setting in the project\'s description.');
    return;
  }

  console.warn(`Retrieve environment variables...`);
  const CALENDAR_SERVER = await getEnvKey('CALENDAR_SERVER', 'www.w3.org');
  console.warn(`- CALENDAR_SERVER: ${CALENDAR_SERVER}`);
  // Events need to be authored by "someone". That someone does not appear in
  // the event itself, but has rights over it. 41989 is François's ID:
  // https://www.w3.org/users/41989/
  const W3C_AUTHOR = await getEnvKey('W3C_AUTHOR', 41989);
  console.warn(`- W3C_AUTHOR: ${W3C_AUTHOR}`);
  const W3C_TOKEN = await getEnvKey('W3C_TOKEN');
  console.warn(`- W3C_TOKEN: ***`);
  console.warn(`Retrieve environment variables... done`);

  if (sessionToSynchronize === 'all') {
    console.warn();
    console.warn(`Validate grid...`);
    let { errors } = await validateGrid(project);
    errors = errors.filter(error => error.severity === 'error');
    console.warn(`- ${errors.length} problems found`);
    const sessions = project.sessions.filter(session =>
      !errors.find(error => error.number === session.number));
    console.warn(`- found ${sessions.length} valid sessions among them: ${sessions.map(s => s.number).join(', ')}`);
    console.warn(`Validate grid... done`);

    for (const session of sessions) {
      console.warn();
      console.warn(`Convert session ${session.number} to calendar entries...`);
      const room = project.rooms.find(r => r.name === session.room);
      await synchronizeSessionWithCalendar({
        session, project,
        calendarServer: CALENDAR_SERVER,
        token: W3C_TOKEN,
        author: W3C_AUTHOR,
        status: options.status ?? project.metadata.calendar
      });
      console.warn(`Convert session ${session.number} to calendar entries... done`);
      console.warn('Wait 2s to ease load on calendar server...');
      await sleep(2000);
      console.warn('Wait 2s to ease load on calendar server... done');
    }
  }
  else {
    const sessionNumber = parseInt(number, 10);
    const session = project.sessions.find(s => s.number === sessionNumber);
    console.warn();
    console.warn(`Validate session ${sessionNumber}...`);
    if (!session) {
      throw new Error(`Session ${sessionNumber} not found in project`);
    }
    let errors = await validateSession(sessionNumber, project);
    errors = errors.filter(error => error.severity === 'error');
    if (errors.length > 0) {
      if (options.quiet) {
        console.warn(`Session ${sessionNumber} contains errors that need fixing, skip`);
        return;
      }
      else {
        throw new Error(`Session ${sessionNumber} contains errors that need fixing`);
      }
    }

    console.warn();
    console.warn(`Convert session ${session.number} to calendar entries...`);
    const room = project.rooms.find(r => r.name === session.room);
    await synchronizeSessionWithCalendar({
      session, project,
      calendarServer: CALENDAR_SERVER,
      token: W3C_TOKEN,
      author: W3C_AUTHOR,
      status: options.status ?? project.metadata.calendar
    });
    console.warn(`Convert session ${session.number} to calendar entries... done`);
  }
}