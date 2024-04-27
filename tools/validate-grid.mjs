#!/usr/bin/env node
/**
 * This tool validates the grid and sets a few validation results accordingly.
 * Unless user requests full re-validation of the sessions, validation results
 * managed by the tool are those related to scheduling problems (in other words,
 * problems that may arise when an admin chooses a room and slot).
 *
 * To run the tool:
 *
 *  node tools/validate-grid.mjs [validation]
 *
 * where [validation] is either "scheduling" (default) to validate only
 * scheduling conflicts or "everything" to re-validate all sessions.
 */

import { getEnvKey } from './lib/envkeys.mjs';
import { fetchProject, saveSessionValidationResult } from './lib/project.mjs'
import { validateGrid } from './lib/validate.mjs';

const schedulingErrors = [
  'error: chair conflict',
  'error: scheduling',
  'error: irc',
  'warning: capacity',
  'warning: conflict',
  'warning: duration',
  'warning: track'
];

async function main(validation) {
  // First, retrieve known information about the project and the session
  const PROJECT_OWNER = await getEnvKey('PROJECT_OWNER', 'w3c');
  const PROJECT_NUMBER = await getEnvKey('PROJECT_NUMBER');
  const CHAIR_W3CID = await getEnvKey('CHAIR_W3CID', {}, true);
  console.log();
  console.log(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER}...`);
  const project = await fetchProject(PROJECT_OWNER, PROJECT_NUMBER);
  if (!project) {
    throw new Error(`Project ${PROJECT_OWNER}/${PROJECT_NUMBER} could not be retrieved`);
  }
  project.chairsToW3CID = CHAIR_W3CID;
  console.log(`- ${project.sessions.length} sessions`);
  console.log(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER}... done`);

  console.log();
  console.log(`Validate grid...`);
  const errors = (await validateGrid(project))
    .filter(error => validation === 'everything' || schedulingErrors.includes(`${error.severity}: ${error.type}`));
  console.log(`- ${errors.length} problems found`);
  console.log(`Validate grid... done`);

  // Time to record session validation issues
  for (const session of project.sessions) {
    console.log();
    console.log(`Save validation results for session ${session.number}...`);
    for (const severity of ['Error', 'Warning', 'Check']) {
      let results = errors
        .filter(error => error.session === session.number && error.severity === severity.toLowerCase())
        .map(error => error.type);
      if (severity === 'Check' &&
          session.validation.check?.includes('irc channel') &&
          !results.includes('irc channel')) {
        // Need to keep the 'irc channel' value until an admin removes it
        results.push('irc channel');
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
      if (validation !== 'everything' && session.validation[severity.toLowerCase()]) {
        // Need to preserve previous results that touched on other aspects
        const previousResults = session.validation[severity.toLowerCase()]
          .split(',')
          .map(value => value.trim());
        for (const result of previousResults) {
          if (!schedulingErrors.includes(`${severity.toLowerCase()}: ${result}`)) {
            results.push(result);
          }
        }
      }
      results = results.sort();
      session.validation[severity.toLowerCase()] = results.join(', ');
    }
    await saveSessionValidationResult(session, project);
    console.log(`Save validation results for session ${session.number}... done`);
  }

  if (validation !== 'everything') {
    const resetSessions = project.sessions.filter(session =>
      !sessions.find(s => s.number === session.number));
    for (const session of resetSessions) {
      let updated = false;
      for (const severity of ['Error', 'Warning', 'Check']) {
        if (!session.validation[severity.toLowerCase()]) {
          continue;
        }
        let results = [];
        const previousResults = session.validation[severity.toLowerCase()]
          .split(',')
          .map(value => value.trim());
        for (const result of previousResults) {
          if (!schedulingErrors.includes(`${severity.toLowerCase()}: ${result}`)) {
            results.push(result);
          }
        }
        if (results.length !== previousResults.length) {
          results = results.sort();
          session.validation[severity.toLowerCase()] = results.join(', ');
          updated = true;
        }
      }
      if (updated) {
        console.log(`Save validation results for session ${session.number}...`);
        await saveSessionValidationResult(session, project);
        console.log(`Save validation results for session ${session.number}... done`);
      }
    }
  }
}


main(process.argv[2] ?? 'scheduling')
  .catch(err => {
    console.log(`Something went wrong: ${err.message}`);
    throw err;
  });