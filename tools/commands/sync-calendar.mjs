import puppeteer from 'puppeteer';
import { getEnvKey } from '../lib/envkeys.mjs';
import { synchronizeSessionWithCalendar } from '../lib/calendar.mjs';
import { validateSession, validateGrid } from '../lib/validate.mjs';

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
  const W3C_LOGIN = await getEnvKey('W3C_LOGIN');
  console.warn(`- W3C_LOGIN: ${W3C_LOGIN}`);
  const W3C_PASSWORD = await getEnvKey('W3C_PASSWORD');
  console.warn(`- W3C_PASSWORD: ***`);
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

    console.warn();
    console.warn('Launch Puppeteer...');
    const browser = await puppeteer.launch({ headless: true });
    console.warn('Launch Puppeteer... done');

    try {
      for (const session of sessions) {
        console.warn();
        console.warn(`Convert session ${session.number} to calendar entries...`);
        const room = project.rooms.find(r => r.name === session.room);
        await synchronizeSessionWithCalendar({
          browser, session, project,
          calendarServer: CALENDAR_SERVER,
          login: W3C_LOGIN,
          password: W3C_PASSWORD,
          status: options.status ?? project.metadata.calendar,
          roomZoom: project.roomZoom
        });
        console.warn(`Convert session ${session.number} to calendar entries... done`);
      }
    }
    finally {
      console.warn();
      console.warn('Close Puppeteer...');
      await browser.close();
      console.warn('Close Puppeteer... done');
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
    console.warn('Launch Puppeteer...');
    const browser = await puppeteer.launch({ headless: true });
    console.warn('Launch Puppeteer... done');

    try {
      console.warn();
      console.warn(`Convert session ${session.number} to calendar entries...`);
      const room = project.rooms.find(r => r.name === session.room);
      await synchronizeSessionWithCalendar({
        browser, session, project,
        calendarServer: CALENDAR_SERVER,
        login: W3C_LOGIN,
        password: W3C_PASSWORD,
        status: options.status ?? project.metadata.calendar,
        roomZoom: project.roomZoom
      });
      console.warn(`Convert session ${session.number} to calendar entries... done`);
    }
    finally {
      console.warn();
      console.warn('Close Puppeteer...');
      await browser.close();
      console.warn('Close Puppeteer... done');
    }
  }
}