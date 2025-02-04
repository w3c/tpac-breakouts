import { sendGraphQLRequest } from '../../common/graphql.mjs';
import { getEnvKey } from '../../common/envkeys.mjs';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as YAML from 'yaml';
import {
  fetchProjectFromGitHub,
  parseProjectDescription } from '../../common/project.mjs';

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
export async function fetchProject(login, id) {
  // Time to read the issue template that goes with the project
  // TODO: the template file should rather be passed as function parameter!
  const templateDefault = path.join('.github', 'ISSUE_TEMPLATE', 'session.yml');
  const templateFile = await getEnvKey('ISSUE_TEMPLATE', templateDefault);
  const templateYaml = await readFile(
    path.join(process.cwd(), templateFile),
    'utf8');
  const template = YAML.parse(templateYaml);
  return fetchProjectFromGitHub(login, id, template);
}


/**
 * Record the meetings assignments for the provided session
 */
export async function saveSessionMeetings(session, project, options) {
  // Project may not have some of the custom fields, and we may only
  // be interested in a restricted set of them
  const fields = ['room', 'day', 'slot', 'meeting', 'trymeout', 'registrants']
    .filter(field => project[field + 'sFieldId'])
    .filter(field => !options || !options.fields || options.fields.includes(field));
  for (const field of fields) {
    const prop = ['meeting', 'trymeout', 'registrants'].includes(field) ?
      'text': 'singleSelectOptionId';
    let value = null;
    if (prop === 'text') {
      // Text field
      if (session[field]) {
        value = `"${session[field]}"`;
      }
    }
    else {
      // Option in a selection field
      const obj = project[field + 's'].find(o => o.name === session[field]);
      if (obj) {
        value = `"${obj.id}"`;
      }
    }
    const resField = await sendGraphQLRequest(`mutation {
      updateProjectV2ItemFieldValue(input: {
        clientMutationId: "mutatis mutandis",
        fieldId: "${project[field + 'sFieldId']}",
        itemId: "${session.projectItemId}",
        projectId: "${project.id}",
        value: {
          ${prop}: ${value}
        }
      }) {
        clientMutationId
      }
    }`);
    if (!resField?.data?.updateProjectV2ItemFieldValue?.clientMutationId) {
      console.log(JSON.stringify(resField, null, 2));
      throw new Error(`GraphQL error, could not assign session #${session.number} to ${field} value "${session[field]}"`);
    }
  }
}


/**
 * Record session validation problems
 */
export async function saveSessionValidationResult(session, project) {
  for (const severity of ['Check', 'Warning', 'Error']) {
    const fieldId = project.severityFieldIds[severity];
    const value = session.validation[severity.toLowerCase()] ?? '';
    const response = await sendGraphQLRequest(`mutation {
      updateProjectV2ItemFieldValue(input: {
        clientMutationId: "mutatis mutandis",
        fieldId: "${fieldId}",
        itemId: "${session.projectItemId}",
        projectId: "${project.id}",
        value: {
          text: "${value}"
        }
      }) {
        clientMutationId
      }
    }`);
    if (!response?.data?.updateProjectV2ItemFieldValue?.clientMutationId) {
      console.log(JSON.stringify(response, null, 2));
      throw new Error(`GraphQL error, could not record "${severity}" for session #${session.number}`);
    }
  }
}
