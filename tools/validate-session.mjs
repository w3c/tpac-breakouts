#!/usr/bin/env node
/**
 * This tool validates a session issue and manages validation results in the
 * project accordingly.
 *
 * To run the tool:
 *
 *  node tools/validate-session.mjs [sessionNumber] [changes]
 *
 * where [sessionNumber] is the number of the issue to validate (e.g. 15)
 * and [changes] is the filename of a JSON file that describes changes made to
 * the body of the issue (e.g. changes.json).
 *
 * The JSON file should look like:
 * {
 *   "body": {
 *     "from": "[previous version]"
 *   }
 * }
 *
 * The JSON file typically matches github.event.issue.changes in a GitHub job.
 */

import path from 'path';
import { getEnvKey } from './lib/envkeys.mjs';
import { fetchProject, saveSessionValidationResult } from './lib/project.mjs'
import { validateSession } from './lib/validate.mjs';
import { parseSessionBody, updateSessionDescription } from './lib/session.mjs';

/**
 * Helper function to generate a shortname from the session's title
 */
function generateShortname(session) {
  return '#' + session.title
    .toLowerCase()
    .replace(/\([^\)]\)/g, '')
    .replace(/[^a-z0-0\-\s]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Retrieve the name of the IRC channel to use for plenary sessions. That name
 * can be defined in the project's description on GitHub. If the name is not
 * specified, `#plenary` is used.
 */
function getProjectPlenaryShortname(project) {
  const channel = project.metadata['plenary channel'];
  if (channel && channel.startsWith('#')) {
    return channel;
  }
  else if (channel) {
    return '#' + channel;
  }
  else {
    return '#plenary';
  }
}

async function main(sessionNumber, changesFile) {
  // First, retrieve known information about the project and the session
  const PROJECT_OWNER = await getEnvKey('PROJECT_OWNER', 'w3c');
  const PROJECT_NUMBER = await getEnvKey('PROJECT_NUMBER');
  const CHAIR_W3CID = await getEnvKey('CHAIR_W3CID', {}, true);
  console.log();
  console.log(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER}...`);
  const project = await fetchProject(PROJECT_OWNER, PROJECT_NUMBER);
  const session = project.sessions.find(s => s.number === sessionNumber);
  if (!project) {
    throw new Error(`Project ${PROJECT_OWNER}/${PROJECT_NUMBER} could not be retrieved`);
  }
  if (!session) {
    throw new Error(`Session ${sessionNumber} not found in project ${PROJECT_OWNER}/${PROJECT_NUMBER}`);
  }
  console.log(`- ${project.sessions.length} sessions`);
  project.chairsToW3CID = CHAIR_W3CID;
  console.log(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER}... done`);

  console.log();
  console.log(`Validate session...`);
  let report = await validateSession(sessionNumber, project, changes);
  for (const error of report) {
    console.log(`- ${error.severity}:${error.type}: ${error.messages.join(', ')}`);
  }
  console.log(`Validate session... done`);

  const checkComments = report.find(error =>
    error.severity === 'check' && error.type === 'instructions');
  if (checkComments &&
      !session.validation.check?.includes('instructions') &&
      changesFile) {
    // The session contains comments and does not have a "check: instructions"
    // flag. That said, an admin may already have validated these comments
    // (and removed the flag). We should only add it back if the comments
    // section changed.
    console.log();
    console.log(`Assess need to add "check: instructions" flag...`);

    // Read JSON file that describes changes if one was given
    // (needs to contain a dump of `github.event.changes` when run in a job)
    const changesFileUrl = 'file:///' +
        path.join(process.cwd(), changesFile).replace(/\\/g, '/');
    const { default: changes } = await import(
      changesFileUrl,
      { assert: { type: 'json' } }
    );
    if (!changes.body?.from) {
      console.log(`- no previous version of session body, add flag`);
    }
    else {
      console.log(`- previous version of session body found`);
      try {
        const previousDescription = parseSessionBody(changes.body.from);
        const newDescription = parseSessionBody(session.body);
        if (newDescription.comments === previousDescription.comments) {
          console.log(`- no change in comments section, no need to add flag`);
          report = report.filter(error =>
            !(error.severity === 'check' && error.type === 'instructions'));
        }
        else {
          console.log(`- comments section changed, add flag`);
        }
      }
      catch {
        // Previous version could not be parsed. Well, too bad, let's add
        // the "check: comments" flag then.
        // TODO: consider doing something smarter as broken format errors
        // will typically arise when author adds links to agenda/minutes.
        console.log(`- previous version of session body could not be parsed, add flag`);
      }
    }
    console.log(`Assess need to add "check: instructions" flag... done`);
  }

  // No IRC channel provided, one will be created, let's add a
  // "check: irc channel" flag
  if (!report.find(err => err.severity === 'error' && err.type === 'format') &&
      !session.description.shortname &&
      (session.description.type !== 'plenary')) {
    report.push({
      session: sessionNumber,
      severity: 'check',
      type: 'irc channel',
      messages: ['IRC channel was generated from the title']
    });
  }

  // Time to record session validation issues
  console.log();
  console.log(`Save session validation results...`);
  for (const severity of ['Error', 'Warning', 'Check']) {
    let results = report
      .filter(error => error.severity === severity.toLowerCase())
      .map(error => error.type)
      .sort();
    if (severity === 'Check' &&
        session.validation.check?.includes('irc channel') &&
        !results.includes('irc channel')) {
      // Need to keep the 'irc channel' value until an admin removes it
      results.push('irc channel');
      results = results.sort();
    }
    else if (severity === 'Warning' && session.validation.note) {
      results = results.filter(warning => {
        const keep =
          !session.validation.note.includes(`-warning:${warning}`) &&
          !session.validation.note.includes(`-warn:${warning}`) &&
          !session.validation.note.includes(`-w:${warning}`);
        if (!keep) {
          console.log(`- drop warning:${warning} per note`);
        }
        return keep;
      });
    }
    session.validation[severity.toLowerCase()] = results.join(', ');
  }
  await saveSessionValidationResult(session, project);
  console.log(`Save session validation results... done`);

  // Prefix IRC channel with '#' if not already done
  if (!report.find(err => err.severity === 'error' && err.type === 'format') &&
      session.description.shortname &&
      !session.description.shortname.startsWith('#')) {
    console.log();
    console.log(`Add '#' prefix to IRC channel...`);
    session.description.shortname = '#' + session.description.shortname;
    await updateSessionDescription(session);
    console.log(`Add '#' prefix to IRC channel... done`);
  }

  // Or force IRC channel to the plenary one if session is a plenary session
  const plenaryShortname = getProjectPlenaryShortname(project);
  if (!report.find(err => err.severity === 'error' && err.type === 'format') &&
      (session.description.type === 'plenary') &&
      (session.description.shortname !== plenaryShortname)) {
    console.log();
    console.log(`Associate session with plenary IRC channel...`);
    session.description.shortname = plenaryShortname;
    await updateSessionDescription(session);
    console.log(`Associate session with plenary IRC channel... done`);
  }
  // Or generate IRC channel if it was not provided
  else if (!report.find(err => err.severity === 'error' && err.type === 'format') &&
      !session.description.shortname) {
    console.log();
    console.log(`Generate IRC channel...`);
    session.description.shortname = generateShortname(session);
    await updateSessionDescription(session);
    console.log(`Generate IRC channel... done`);
  }
}


// Read session number from command-line
if (!process.argv[2] || !process.argv[2].match(/^\d+$/)) {
  console.log('Command needs to receive a session number as first parameter');
  process.exit(1);
}
const sessionNumber = parseInt(process.argv[2], 10);

// Read change filename from command-line if specified
const changes = process.argv[3];

main(sessionNumber, changes)
  .catch(err => {
    console.log(`Something went wrong: ${err.message}`);
    throw err;
  });