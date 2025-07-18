#!/usr/bin/env node
/**
 * This tool adds a link to W3C IRC minutes to one (or all) sessions
 *
 * To run the tool:
 *
 *  node tools/add-minutes.mjs [sessionNumber]
 *
 * where [sessionNumber] is the number of the issue to process (e.g. 15).
 * Leave empty to add minute links to all sessions.
 */

import { getEnvKey } from './common/envkeys.mjs';
import { loadProject } from './node/lib/project.mjs'
import { validateSession } from './common/validate.mjs';
import { updateSessionDescription } from './common/session.mjs';
import { getProjectSlot } from './common/project.mjs';
import todoStrings from './common/todostrings.mjs';


async function main(number) {
  const project = await loadProject();
  let sessions = project.sessions.filter(s => s.slot && s.room &&
    (!number || s.number === number));
  sessions.sort((s1, s2) => s1.number - s2.number);
  if (number) {
    if (sessions.length === 0) {
      throw new Error(`Session ${number} not found (or did not take place) in project ${PROJECT_OWNER}/${PROJECT_NUMBER}`);
    }
  }
  else {
    console.log(`- found ${sessions.length} sessions assigned to a slot and room: ${sessions.map(s => s.number).join(', ')}`);
  }
  sessions = await Promise.all(sessions.map(async session => {
    const sessionErrors = (await validateSession(session.number, project))
      .filter(error => error.severity === 'error');
    if (sessionErrors.length > 0) {
      return null;
    }
    return session;
  }));
  sessions = sessions.filter(s => !!s);
  if (number) {
    if (sessions.length === 0) {
      throw new Error(`Session ${number} contains errors that need fixing`);
    }
    else if (sessions[0].description.materials?.minutes &&
        !todoStrings.includes(session.description.materials.minutes)) {
      console.log(`- session already has a link to minutes`);
      return;
    }
  }
  else {
    sessions = sessions.filter(s =>
      !s.description.materials ||
      !s.description.materials.minutes ||
      todoStrings.includes(s.description.materials.minutes));
    if (sessions.length === 0) {
      console.log(`- no valid session that needs minutes among them`);
    }
    else {
      console.log(`- found ${sessions.length} valid sessions that need minutes among them: ${sessions.map(s => s.number).join(', ')}`);
    }
  }

  console.log();
  console.log('Link to minutes...');
  for (const session of sessions) {
    // TODO: date is in the timezone of the TPAC event but actual dated URL
    // is on Boston time. No big deal for TPAC meetings in US / Europe, but
    // problematic when TPAC is in Asia.
    const slot = getProject(project, session.slot);
    const year = slot.date.substring(0, 4);
    const month = slot.date.substring(5, 7);
    const mday = slot.date.substring(8, 10);
    const url = `https://www.w3.org/${year}/${month}/${mday}-${session.description.shortname.substring(1)}-minutes.html`;
    const response = await fetch(url);
    if ((response.status !== 200) && (response.status !== 401)) {
      console.log(`- no minutes found for session ${session.number}: ${url} yields a ${response.status}`);
    }
    else {
      console.log(`- link session ${session.number} to minutes at ${url}`);
      if (!session.description.materials) {
        session.description.materials = {};
      }
      session.description.materials.minutes = url;
      await updateSessionDescription(session);
    }
  }
  console.log('Link to minutes... done');
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