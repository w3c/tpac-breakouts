#!/usr/bin/env node
/**
 * @@
 *
 * To run the tool:
 *
 *  node tools/minutes-to-w3c.mjs [sessionNumber]
 *
 * where [sessionNumber] is the number of the issue to process (e.g. 15).
 * Leave empty to add minute links to all sessions.
 */

import { getEnvKey } from './lib/envkeys.mjs';
import { fetchProject } from './lib/project.mjs'
import { validateSession } from './lib/validate.mjs';
import puppeteer from 'puppeteer';

async function main(number) {
  const PROJECT_OWNER = await getEnvKey('PROJECT_OWNER');
  const PROJECT_NUMBER = await getEnvKey('PROJECT_NUMBER');
  console.log();
  console.log(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER}...`);
  const project = await fetchProject(PROJECT_OWNER, PROJECT_NUMBER);
  if (!project) {
    throw new Error(`Project ${PROJECT_OWNER}/${PROJECT_NUMBER} could not be retrieved`);
  }
  let sessions = project.sessions.filter(s => s.slot && s.room &&
    (!number || s.number === number));
  sessions.sort((s1, s2) => s1.number - s2.number);
  if (number) {
    if (sessions.length === 0) {
      throw new Error(`Session ${number} not found (or did not take place) in project ${PROJECT_OWNER}/${PROJECT_NUMBER}`);
    }
  }
  else {
    console.log(`- found ${sessions.length} sessions assigned to a slot and room`);
  }
  sessions = await Promise.all(sessions.map(async session => {
    const sessionErrors = (await validateSession(session.number, project))
      .filter(error => error.severity === 'error');
    return session;
  }));
  sessions = sessions.filter(s => !!s);
  if (number) {
    if (sessions.length === 0) {
      throw new Error(`Session ${number} contains errors that need fixing`);
    }
    else if (sessions[0].description.materials.minutes) {
	console.log("Session " + number + ": " + sessions[0].description.materials.minutes);
      return;
    }
  }
    else {
	for (const session of sessions.filter(s => s.description.materials.minutes)) {
	    const url = session.description.materials.minutes;
	    if (url.match(/w3\.org|\@\@/)) {
		console.log("Skipping " + session.number + ": " + url);
            } else if (url.match(/docs\.google\.com/)) {
		console.log(session.number + ": " + session.description.materials.minutes);
		(async () => {
		    const browser = await puppeteer.launch();
		    const page = await browser.newPage();
		    await page.goto(url);
		    await page.pdf({
			path: session.number + '-minutes.pdf',
		    });
		    await browser.close();
		})();
	    } else {
		console.log("Manually get: " + session.number + ": " + session.description.materials.minutes);
	    }
        }
  }
  console.log(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER} and session(s)... done`);
}


// Read session number from command-line
if (process.argv[2] && !process.argv[2].match(/^(\d+|all)$/)) {
  console.log('First parameter should be a session number or "all"');
  process.exit(1);
}
const sessionNumber = process.argv[2]?.match(/^\d+$/) ? parseInt(process.argv[2], 10) : undefined;

main(sessionNumber)
  .catch(err => {
    console.log(`Something went wrong: ${err.message}`);
    throw err;
  });
