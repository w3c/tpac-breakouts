#!/usr/bin/env node
/**
 * This tool reports information about breakout session chairs.
 *
 * To run the tool:
 *
 *  node tools/list-chairs.mjs
 */

import { getEnvKey } from './lib/envkeys.mjs';
import { fetchProject } from './lib/project.mjs'
import { validateGrid } from './lib/validate.mjs';
import { authenticate } from './lib/calendar.mjs';
import checkRegistrants from './lib/check-registrants.mjs';
import puppeteer from 'puppeteer';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms, 'slept'));
}

async function main(format) {
  format = format ?? 'text';

  const PROJECT_OWNER = await getEnvKey('PROJECT_OWNER', 'w3c');
  const PROJECT_NUMBER = await getEnvKey('PROJECT_NUMBER');
  const W3CID_MAP = await getEnvKey('W3CID_MAP', {}, true);
  const W3C_LOGIN = await getEnvKey('W3C_LOGIN');
  const W3C_PASSWORD = await getEnvKey('W3C_PASSWORD');
  console.warn();
  console.warn(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER}...`);
  const project = await fetchProject(PROJECT_OWNER, PROJECT_NUMBER);
  if (!project) {
    throw new Error(`Project ${PROJECT_OWNER}/${PROJECT_NUMBER} could not be retrieved`);
  }
  project.w3cIds = W3CID_MAP;
  const { errors } = await validateGrid(project)
  console.warn(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER}... done`);

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
            return el.textContent.trim();
          });
        }
        finally {
          page.close();
        }
        console.warn('Wait 1s to ease load on server...');
        await sleep(1000);
        console.warn('Wait 1s to ease load on server... done');
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
