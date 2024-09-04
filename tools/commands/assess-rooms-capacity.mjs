import puppeteer from 'puppeteer';
import { validateSession } from '../lib/validate.mjs';
import { getEnvKey } from '../lib/envkeys.mjs';
import { parseSessionMeetings } from '../lib/meetings.mjs';

/**
 * Login to W3C server.
 *
 * The function throws if login fails.
 * 
 * TODO: same code as in tools/lib/calendar.mjs, move to common lib
 */
export async function authenticate(page, login, password, redirectUrl) {
  const url = await page.evaluate(() => window.location.href);
  if (!url.endsWith('/login')) {
    return;
  }

  const usernameInput = await page.waitForSelector('input#username');
  await usernameInput.type(login);

  const passwordInput = await page.waitForSelector('input#password');
  await passwordInput.type(password);

  const submitButton = await page.waitForSelector('button[type=submit]');
  await submitButton.click();

  await page.waitForNavigation();
  const newUrl = await page.evaluate(() => window.location.href);
  if (newUrl !== redirectUrl) {
    throw new Error('Could not login. Invalid credentials?');
  }
}

export default async function (project, number, options) {
  const meeting = project.metadata.meeting.toLowerCase().replace(/\s+/g, '');
  const registrantsUrl = options?.url ??
    `https://www.w3.org/register/${meeting}/registrants`;

  console.warn(`Retrieve environment variables...`);
  const W3C_LOGIN = await getEnvKey('W3C_LOGIN');
  console.warn(`- W3C_LOGIN: ${W3C_LOGIN}`);
  const W3C_PASSWORD = await getEnvKey('W3C_PASSWORD');
  console.warn(`- W3C_PASSWORD: ***`);
  console.warn(`Retrieve environment variables... done`);

  let attendance = [];

  console.warn();
  console.warn('Launch Puppeteer...');
  const browser = await puppeteer.launch({ headless: true });
  console.warn('Launch Puppeteer... done');

  try {
    const page = await browser.newPage();
    try {
      await page.goto(registrantsUrl);
      await authenticate(page, W3C_LOGIN, W3C_PASSWORD, registrantsUrl);
      attendance = await page.evaluate(() =>
        [...document.querySelectorAll('h2[id^=meeting]')]
          .map(heading => {
            const res = {
              id: heading.id,
              // Note ad-hoc fixes for a few typos in TPAC 2024 registrants
              // page: https://www.w3.org/register/tpac2024/registrants
              groups: heading
                .innerText
                .replace(/JSON for Linking Data/, 'JSON for Linked Data')
                .replace(/Accessible Platform Architectures joint/, 'Accessible Platform Architectures WG joint')
                .replace(/(meeting )+on-site attendance/i, '')
                .replace(/Attendance for the/i, '')
                .split(' joint meeting with ')
                .map((item, idx) => idx === 0 ? item : item.split(','))
                .flat()
                .map(g => g.trim()),
              nbParticipants: 0,
              nbObservers: 0
            };

            let el = heading.nextElementSibling;
            if (el?.nodeName !== 'P') {
              // Should be a paragraph with the number of participants.
              return res;
            }
            const nbParticipants = el.innerText
              .match(/(\d+) people registered as group participant/);
            if (nbParticipants) {
              res.nbParticipants = parseInt(nbParticipants[1], 10);
              el = el.nextElementSibling;
              if (el?.nodeName !== 'UL') {
                // Should be the list of participants.
                return res;
              }
              el = el.nextElementSibling;
              if (el?.nodeName !== 'P') {
                // Should be a paragraph that with an "Email all at once" link.
                return res;
              }
              el = el.nextElementSibling;
              if (el?.nodeName !== 'P') {
                // Should be a paragraph with the number of observers.
                return res;
              }
              const nbObservers = el.innerText
                .match(/(\d+) people registered as observer/);
              if (nbObservers) {
                res.nbObservers = parseInt(nbObservers[1], 10);
              }
            }
            return res;
          })
      );
    }
    finally {
      await page.close();
    }
  }
  finally {
    console.warn();
    console.warn('Close Puppeteer...');
    await browser.close();
    console.warn('Close Puppeteer... done');
  }

  console.warn();
  console.warn('Validate sessions...');
  const sessions = project.sessions.filter(session =>
    number.toLowerCase() === 'all' || session.number === parseInt(number, 10));
  for (const session of sessions) {
    await validateSession(session.number, project);
  }
  console.warn('Validate sessions... done');

  console.warn();
  console.warn('Map registration page to sessions...');
  const mapped = attendance.map(meetingAttendance => {
    const groups = meetingAttendance.groups;
    const session = sessions.find(session =>
      (groups.length === 1 && groups[0] === session.title) ||
      (groups.length === session.groups.length &&
        groups.every(group => session.groups.find(g => g.name === group))));
    if (!session) {
      if (number.toLowerCase() === 'all') {
        console.warn(`- warning: coud not find a session for "${groups.join(', ')}"`);
      }
      return null;
    }
    const meetings = parseSessionMeetings(session, project);
    const rooms = meetings
      .map(meeting => project.rooms.find(room => room.name === meeting.room))
      .filter(room => !!room)
      .filter((room, idx, list) => list.findIndex(r => r.name === room.name) === idx);
    return Object.assign({}, session, {
      id: meetingAttendance.id,
      nbParticipants: meetingAttendance.nbParticipants,
      nbObservers: meetingAttendance.nbObservers,
      rooms
    });
  }).filter(s => !!s);
  console.warn('Map registration page to sessions... done');

  console.warn();
  console.warn('Assess meeting rooms capacity...');
  console.log('## Too many Participants');    
  for (const session of mapped) {
    const tooSmall = session.rooms.filter(room => room.capacity < session.nbParticipants);
    if (tooSmall.length > 0) {
      const sessionUrl = `https://github.com/${session.repository}/issues/${session.number}`;
      console.log(`- [${session.title}](${sessionUrl})`);
      for (const room of tooSmall) {
          console.log(`  - in ${room.label}: capacity is ${room.capacity}, [${session.nbParticipants} group participants](${registrantsUrl}#${session.id}) (plus ${session.nbObservers} observers, total: ${session.nbParticipants + session.nbObservers}).`);
        }
      }
  }
  console.log('\n## Too many Observers');    
  for (const session of mapped) {
    const tooSmall = session.rooms.filter(room =>
      room.capacity > session.nbParticipants && room.capacity < session.nbParticipants + session.nbObservers);
    if (tooSmall.length > 0) {
      const sessionUrl = `https://github.com/${session.repository}/issues/${session.number}`;
      console.log(`- [${session.title}](${sessionUrl})`);
      for (const room of tooSmall) {
          console.log(`  - in ${room.label}: capacity is ${room.capacity}, [${session.nbParticipants} group participants](${registrantsUrl}#${session.id}) but also ${session.nbObservers} observers, total: ${session.nbParticipants + session.nbObservers}.`)
      }
    }
  }
console.warn('Assess meeting rooms capacity... done');
}
