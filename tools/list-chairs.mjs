#!/usr/bin/env node
/**
 * This tool reports information about breakout session chairs.
 *
 * To run the tool:
 *
 *  node tools/list-chairs.mjs
 */

import { getEnvKey } from './common/envkeys.mjs';
import { loadProject } from './node/lib/project.mjs'
import { validateGrid } from './common/validate.mjs';
import checkRegistrants from './node/lib/check-registrants.mjs';
import puppeteer from 'puppeteer';

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

  const res = await validateGrid(project, { what: 'everything' });

  const sessions = project.sessions.filter(session => session.chairs);
  sessions.sort((s1, s2) => s1.number - s2.number);

  const chairs = sessions
    .map(session => session.chairs)
    .flat()
    .filter((chair, index, list) => list.findIndex(c =>
      c.name === chair.name || c.login === chair.login || c.w3cId === chair.w3cId) === index);

  function formatChair(chair) {
    const parts = [];
    if (chair.name && chair.email) {
      parts.push(`${chair.name} <${chair.email}>`);
    }
    else if (chair.name) {
      parts.push(`${chair.name}`);
    }
    if (chair.login) {
      parts.push(`https://github.com/${chair.login}`);
    }
    if (chair.w3cId) {
      parts.push(`https://www.w3.org/users/${chair.w3cId}`);
    }
    return parts.join(' ');
  }

  if (W3C_LOGIN && W3C_PASSWORD) {
    console.warn();
    console.warn('Retrieving chair emails...');
    const browser = await puppeteer.launch({ headless: true });
    try {
      for (const chair of chairs) {
        if (!chair.w3cId) {
          continue;
        }
        const page = await browser.newPage();
        const url = `https://www.w3.org/users/${chair.w3cId}/`;
        try {
          await page.goto(url);
          await authenticate(page, W3C_LOGIN, W3C_PASSWORD, url);
          chair.email = await page.evaluate(() => {
            const el = document.querySelector('.card--user a[href^=mailto]');
            if (el) {
              return el.textContent.trim();
            }
            else {
              return 'no email address found in user page';
            }
          });
          console.warn('Wait 4s to ease load on server...');
          await sleep(4000);
          console.warn('Wait 4s to ease load on server... done');
        }
        finally {
          page.close();
        }
      }
    }
    finally {
      browser.close();
    }
    console.warn('Retrieving chair emails... done');
  }

  if (format === 'json' || format === 'js') {
    const copy = chairs.map(chair => {
      return Object.assign({}, chair, {
        sessions: sessions
          .filter(s => s.chairs.find(c => c.name === chair.name))
          .map(s => {
            return { number: s.number, title: s.title, chairs: s.chairs };
          })
      });
    });
    if (format === 'json') {
      console.log(JSON.stringify(copy, null, 2));
    }
    else {
      console.log('const chairs = ' + JSON.stringify(copy, null, 2) + ';');
      console.log();
      console.log(checkRegistrants.toString());
      console.log();
      console.log('console.log(checkRegistrants(chairs));');
    }
  }
  else {
    console.log();
    console.log('All chairs');
    console.log('----------');
    for (const chair of chairs) {
      console.log(formatChair(chair));
    }

    console.log();
    console.log('All emails');
    console.log('----------');
    const emails = chairs
      .filter(chair => chair.email)
      .map(chair => `${chair.name} <${chair.email}>`)
    console.log(emails.join(', '));

    console.log();
    console.log('Per session');
    console.log('-----------');
    for (const session of sessions) {
      console.log(`#${session.number} - ${session.title}`);
      for (const chair of session.chairs) {
        console.log(formatChair(chair));
      }
      console.log();
    }
  }
}

main(process.argv[2])
  .catch(err => {
    console.error(`Something went wrong: ${err.message}`);
    throw err;
  });
