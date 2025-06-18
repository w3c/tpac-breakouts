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

import { getEnvKey } from './common/envkeys.mjs';
import { loadProject } from './node/lib/project.mjs'
import { validateSession } from './node/lib/validate.mjs';
import fs from 'node:fs/promises';

async function main(number, minutesPrefix) {
  const project = await loadProject();
  let sessions = project.sessions.filter(s => s.slot && s.room &&
    (!number || s.number === number));
  sessions.sort((s1, s2) => s1.number - s2.number);
  if (number) {
    if (sessions.length === 0) {
      throw new Error(`Session ${number} not found (or did not take place)`);
    }
  }
  else {
    console.warn(`- found ${sessions.length} sessions assigned to a slot and room`);
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
  }
  for (const session of sessions.filter(s => s.description?.materials?.minutes)) {
    const url = session.description.materials.minutes;
    if (url.match(/w3\.org|\@\@/)) {
      console.warn(`- ${session.number}: skipping minutes at ${url}`);
    }
    else if (url.match(/docs\.google\.com/)) {
      console.warn(`- ${session.number}: processing minutes at ${url}`);
      console.log(`=====`);
      console.log(`Session #${session.number} ${session.title}`);
      console.log(`https://github.com/${session.repository}/issues/${session.number}`);
      const file = `minutes-${session.number}.html`;
      const exportUrl = url.match(/\/edit.*$/) ?
        url.replace(/\/edit.*$/, '/export') :
        url + '/export';
      const res = await fetch(exportUrl);

      // Links in Google Docs are prefixed, and additional styles may be
      // imported. Get rid of that to avoid relying on third-party servers.
      let html = await res.text();
      html = html
        .replace(/@import url\(https:\/\/themes\.googleusercontent\.com\/[^\)]*\);/g, '')
        .replace(/href="https:\/\/www\.google\.com\/url\?q=([^&]+)&[^"]+"/g, 'href="$1"');
      await fs.writeFile(file, html, 'utf8');
      console.log(`- [Minutes](${minutesPrefix}/minutes-${session.number}.html)`);
      console.log(`- [Minutes - initial Google doc](${url})`);
    }
    else {
      console.warn(`- ${session.number}: need to get minutes at ${url}`);
    }
  }
}


// Read session number from command-line
if (process.argv[2] && !process.argv[2].match(/^(\d+|all)$/)) {
  console.warn('First parameter should be a session number or "all"');
  process.exit(1);
}
const sessionNumber = process.argv[2]?.match(/^\d+$/) ? parseInt(process.argv[2], 10) : undefined;
const minutesPrefix = process.argv[3];

main(sessionNumber, minutesPrefix)
  .catch(err => {
    console.error(`Something went wrong: ${err.message}`);
    throw err;
  });
