import puppeteer from 'puppeteer';
import { validateSession } from '../lib/validate.mjs';
import { authenticate } from '../lib/calendar.mjs';
import { getEnvKey } from '../lib/envkeys.mjs';
import { parseSessionMeetings } from '../lib/meetings.mjs';
import { saveSessionMeetings } from '../lib/project.mjs';

export default async function (project, number, options) {
  const meeting = project.metadata.meeting.toLowerCase().replace(/\s+/g, '');
  const registrantsUrl = options?.url ??
    `https://www.w3.org/register/${meeting}/registrants`;

  console.warn('Validate options...');
  if (options?.save && !options?.fetch) {
    console.error('- The --fetch option must be set when --save is set');
    return;
  }
  if (options?.url && !options?.fetch) {
    console.error('- The --fetch option must be set when --url is set');
    return;
  }
  console.warn('Validate options... done');

  console.warn('Validate sessions...');
  const sessions = project.sessions.filter(session =>
    number.toLowerCase() === 'all' || session.number === parseInt(number, 10));
  for (const session of sessions) {
    await validateSession(session.number, project);
  }
  console.warn('Validate sessions... done');

  if (options?.fetch) {
    console.warn('Launch Puppeteer...');
    const browser = await puppeteer.launch({ headless: true });
    console.warn('Launch Puppeteer... done');

    let allRegistrants = [];
    try {
      console.warn(`Retrieve environment variables...`);
      const W3C_LOGIN = await getEnvKey('W3C_LOGIN');
      console.warn(`- W3C_LOGIN: ${W3C_LOGIN}`);
      const W3C_PASSWORD = await getEnvKey('W3C_PASSWORD');
      console.warn(`- W3C_PASSWORD: ***`);
      console.warn(`Retrieve environment variables... done`);

      console.warn('Fetch registrants...');
      const page = await browser.newPage();
      try {
        await page.goto(registrantsUrl);
        await authenticate(page, W3C_LOGIN, W3C_PASSWORD, registrantsUrl);
        allRegistrants = await page.evaluate(() =>
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
                participants: 0,
                observers: 0
              };

              let el = heading.nextElementSibling;
              if (el?.nodeName !== 'P') {
                // Should be a paragraph with the number of participants.
                return res;
              }
              const nbParticipants = el.innerText
                .match(/(\d+) people registered as group participant/);
              if (nbParticipants) {
                res.participants = parseInt(nbParticipants[1], 10);
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
                  res.observers = parseInt(nbObservers[1], 10);
                }
              }
              return res;
            })
        );
      }
      finally {
        console.warn('Fetch registrants... done');
        await page.close();
      }
    }
    finally {
      console.warn('Close Puppeteer...');
      await browser.close();
      console.warn('Close Puppeteer... done');
    }

    console.warn('Refresh registrants information in sessions...');
    for (const session of sessions) {
      const sessionRegistrants = allRegistrants.find(entry => {
        const groups = entry.groups;
        return (groups.length === 1 && groups[0] === session.title) ||
          (groups.length === session.groups.length &&
            groups.every(group => session.groups.find(g => g.name === group)));
      });
      if (sessionRegistrants) {
        const registrants = '' + sessionRegistrants.participants +
          '+' + sessionRegistrants.observers;
        if (session.registrants !== registrants) {
          console.warn(`- update ${session.title}: "${registrants}" (was "${session.registrants ?? ''}")`);
          session.registrants = registrants;
          session.registrantsUrl = `${registrantsUrl}#${sessionRegistrants.id}`;
          session.updated = true;
        }
      }
      else {
        console.warn(`- warning: coud not find registrants for "${session.title}"`);
      }
    }
    console.warn('Refresh registrants information in sessions... done');
  }

  console.warn('Expand registrants info...');
  const expanded = sessions.map(session => {
    const match = (session.registrants ?? '')
      .match(/^\s*(\d+)\s*(?:\+\s*(\d+)\s*)?$/);
    const participants = parseInt(match?.[1] ?? '0', 10);
    const observers = parseInt(match?.[2] ?? '0', 10);
    const sessionUrl =
      `https://github.com/${session.repository}/issues/${session.number}`;
    const registrantsUrl = session.registrantsUrl ?? sessionUrl;
    const markdown = session.registrantsUrl ?
      `[${session.title}](${sessionUrl}) - [${participants} participants plus ${observers} observers](${registrantsUrl}), total: ${participants + observers}` :
      `[${session.title}](${sessionUrl}) - ${participants} participants plus ${observers} observers, total: ${participants + observers}`;
    return {
      session,
      participants,
      observers,
      total: participants + observers,
      markdown
    };
  })
  console.warn('Expand registrants info... done');

  console.warn('Retrieve session rooms...');
  for (const entry of expanded) {
    const meetings = parseSessionMeetings(entry.session, project);
    entry.rooms = meetings
      .map(meeting => project.rooms.find(room => room.name === meeting.room))
      .filter(room => !!room)
      .filter((room, idx, list) => list.findIndex(r => r.name === room.name) === idx)
      .map(room => Object.assign({}, room, {
        diffParticipants: entry.participants - room.capacity,
        diffTotal: entry.total - room.capacity
      }));
  }
  console.warn('Retrieve session rooms... done');

  if (options?.save) {
    console.warn('Record registrants in project...');
    if (project.allowRegistrants) {
      const sessionsToUpdate = project.sessions.filter(s => s.updated);
      for (const session of sessionsToUpdate) {
        console.warn(`- updating #${session.number}...`);
        await saveSessionMeetings(session, project, { fields: ['registrants'] });
        console.warn(`- updating #${session.number}... done`);
      }
    }
    else {
      console.warn('- no "Registrants" custom field found in project');
    }
    console.warn('Record registrants in project... done');
  }

  console.warn('Assess meeting rooms capacity...');
  const report = {
    greatBigRooms: [],
    middleSizedRooms: [],
    littleWeeRooms: []
  };
  for (const entry of expanded) {
    const greatBigRooms = entry.rooms.filter(room =>
      room.capacity >= entry.total);
    if (greatBigRooms.length > 0) {
      report.greatBigRooms.push(
        Object.assign({}, entry, { rooms: greatBigRooms }));
    }
    const middleSizedRooms = entry.rooms.filter(room =>
      room.capacity < entry.total &&
      room.capacity >= entry.participants);
    if (middleSizedRooms.length > 0) {
      report.middleSizedRooms.push(
        Object.assign({}, entry, { rooms: middleSizedRooms }));
    }
    const littleWeeRooms = entry.rooms.filter(room =>
      room.capacity < entry.participants);
    if (littleWeeRooms.length > 0) {
      report.littleWeeRooms.push(
        Object.assign({}, entry, { rooms: littleWeeRooms }));
    }
  }
  if (!options?.warningsOnly && report.greatBigRooms.length > 0) {
    console.log();
    console.log('## Meetings in large enough rooms');
    for (const entry of report.greatBigRooms) {
      console.log(`- ${entry.markdown}`);
      for (const room of entry.rooms) {
        console.log(`  - in ${room.label}: capacity is ${room.capacity}, ${0 - room.diffTotal} seat${0 - room.diffTotal <= 1 ? '' : 's'} available.`);
      }
    }
  }
  if (report.littleWeeRooms.length > 0) {
    console.log();
    console.log('## Too many Participants');    
    for (const entry of report.littleWeeRooms) {
      console.log(`- ${entry.markdown}`);
      for (const room of entry.rooms) {
        console.log(`  - in ${room.label}: capacity is ${room.capacity}, ${room.diffParticipants} seat${room.diffParticipants <= 1 ? '' : 's'} missing.`);
      }
    }
  }
  if (report.middleSizedRooms.length > 0) {
    console.log();
    console.log('## Too many Observers');
    for (const entry of report.middleSizedRooms) {
      console.log(`- ${entry.markdown}`);
      for (const room of entry.rooms) {
        console.log(`  - in ${room.label}: capacity is ${room.capacity}, ${room.diffTotal} seat${room.diffTotal <= 1 ? '' : 's'} missing.`);
      }
    }
  }
  console.warn('Assess meeting rooms capacity... done');
}
