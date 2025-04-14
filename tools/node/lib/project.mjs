import { sendGraphQLRequest } from '../../common/graphql.mjs';
import { getEnvKey } from '../../common/envkeys.mjs';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as YAML from 'yaml';
import { fetchProjectFromGitHub } from '../../common/project.mjs';

/**
 * Retrieve available project data.
 *
 * This includes:
 * - the list of rooms and their capacity
 * - the list of days
 * - the list of slots and their duration
 * - the detailed list of breakout sessions associated with the project
 * - the room and slot that may already have been associated with each session
 *
 * Returned object should look like:
 * {
 *   "title": "TPAC xxxx breakout sessions",
 *   "url": "https://github.com/orgs/w3c/projects/xx",
 *   "id": "xxxxxxx",
 *   "roomsFieldId": "xxxxxxx",
 *   "rooms": [
 *     { "id": "xxxxxxx", "name": "Salon Ecija (30)", "label": "Salon Ecija", "capacity": 30 },
 *     ...
 *   ],
 *   "slotsFieldId": "xxxxxxx",
 *   "slots": [
 *     { "id": "xxxxxxx", "name": "9:30 - 10:30", "start": "9:30", "end": "10:30", "duration": 60 },
 *     ...
 *   ],
 *   "severityFieldIds": {
 *     "Check": "xxxxxxx",
 *     "Warning": "xxxxxxx",
 *     "Error": "xxxxxxx",
 *     "Note": "xxxxxxx"
 *   },
 *   "sessions": [
 *     {
 *       "repository": "w3c/tpacxxxx-breakouts",
 *       "number": xx,
 *       "title": "Session title",
 *       "body": "Session body, markdown",
 *       "labels": [ "session", ... ],
 *       "author": {
 *         "databaseId": 1122927,
 *         "login": "tidoust"
 *       },
 *       "room": "Salon Ecija (30)",
 *       "slot": "9:30 - 10:30"
 *     },
 *     ...
 *   ],
 *   "labels": [
 *     {
 *       "id": "xxxxxxx",
 *       "name": "error: format"
 *     },
 *     ...
 *   ]
 * }
 */
async function fetchProject(reponame) {
  // Time to read the issue template that goes with the project
  // TODO: the template file should rather be passed as function parameter!
  const templateDefault = path.join('.github', 'ISSUE_TEMPLATE', 'session.yml');
  const templateFile = await getEnvKey('ISSUE_TEMPLATE', templateDefault);
  const templateYaml = await readFile(
    path.join(process.cwd(), templateFile),
    'utf8');
  const template = YAML.parse(templateYaml);
  return fetchProjectFromGitHub(reponame, template);
}


/**
 * All commands start with loading the project associated with the repository
 * in which the command runs.
 */
export async function loadProject() {
  const REPOSITORY = await getEnvKey('REPOSITORY');
  console.warn();
  console.warn(`Retrieve project from ${REPOSITORY}...`);
  const project = await fetchProject(REPOSITORY);
  if (!project) {
    throw new Error(`Project could not be retrieved from ${REPOSITORY}`);
  }
  console.warn(`- found ${project.sessions.length} sessions`);

  // Most commands also need the mappings between chairs and W3C IDs.
  // Synchronization with the calendar needs the Zoom information per room.
  project.w3cIds = await getEnvKey('W3CID_MAP', {}, true);

  console.warn(`Retrieve project from ${REPOSITORY}... done`);
  return project;
}
