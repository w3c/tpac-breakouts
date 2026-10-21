#!/usr/bin/env node
/**
 * This tool reports the number of participants for each breakout session
 * as known by the W3C calendar
 *
 * To run the tool:
 *
 *  node tools/fetch-braekout-participants.mjs
 */

import { getEnvKey } from './common/envkeys.mjs';
import { loadProject } from './node/lib/project.mjs'
import { validateGrid } from './common/validate.mjs';
import checkRegistrants from './node/lib/check-registrants.mjs';
import puppeteer from 'puppeteer';
import { initSectionHandlers, parseSessionBody } from './common/session.mjs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms, 'slept'));
}

/**
 * Login to W3C server.
 *
 * The function throws if login fails.
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

async function main(format) {
  format = format ?? 'text';

  const W3C_LOGIN = await getEnvKey('W3C_LOGIN');
  const W3C_PASSWORD = await getEnvKey('W3C_PASSWORD');
  const project = await loadProject();

  //const res = await validateGrid(project, { what: 'everything' });
  await initSectionHandlers(project);
  for (const session of project.sessions) {
    session.description = parseSessionBody(session.body);
  }

  // project.sessions = project.sessions.slice(0, 4);
  const sessions = project.sessions;
  sessions.sort((s1, s2) => s1.number - s2.number);

  if (W3C_LOGIN && W3C_PASSWORD) {
    console.warn();
    console.warn('Retrieving calendar participants...');
    const browser = await puppeteer.launch({ headless: true });
    try {
      for (const session of sessions) {
        const calendar = session.description.calendar;
        if (!calendar) {
          continue;
        }

        const url = calendar[0].url;
        const page = await browser.newPage();
        try {
          await page.goto(url);
          await authenticate(page, W3C_LOGIN, W3C_PASSWORD, url);
        
          session.participants = await page.evaluate(() => {
            const participants = [...document.querySelectorAll('.fa-user')];
            return participants.length;
          });
          console.warn('Wait 4s to ease load on server...');
          await sleep(3000);
          console.warn('Wait 4s to ease load on server... done');
        }
        finally {
          await page.close();
        }
      }
    }
    finally {
      await browser.close();
    }
    console.warn('Retrieving calendar participants... done');
  }

  const perSlot = Object.groupBy(sessions, session => {
    if (!session.slot) {
      return 'not scheduled';
    }
    else {
      return session.slot;
    }
  });

  const slots = Object.keys(perSlot)
  slots.sort();

  for (const slot of slots) {
    const sessions = perSlot[slot];
    sessions.sort((s1, s2) => {
      if (s1.participants !== s2.participants) {
        return s2.participants - s1.participants;
      }
      else {
        return s1.number - s2.number;
      }
    });

    if (format === 'json' || format === 'js') {
      console.log('TODO');
    }
    else {
      console.log();
      console.log('## ' + slot);
      for (const session of sessions) {
        const room = project.rooms.find(room => room.name === session.room);
        if (room) {
          console.log(`* #${session.number}: ${session.participants} participants in ${session.room} (capacity: ${room.capacity}) - ${session.title}`);
        }
        else {
          console.log(`* #${session.number}: ${session.participants} participants in ${session.room} (capacity: unknown) - ${session.title}`);
        }
      }
    }
  }

  
}

main(process.argv[2])
  .catch(err => {
    console.error(`Something went wrong: ${err.message}`);
    throw err;
  });
