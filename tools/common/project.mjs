import timezones from './timezones.mjs';
import { parseRepositoryName } from './repository.mjs';
import { getSessionSections } from './session-sections.mjs';
import { sendGraphQLRequest } from './graphql.mjs';
import {
  importVariableFromGitHub,
  exportVariableToGitHub
} from './github-variable.mjs';

/**
 * Retrieve available project data from GitHub.
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
 *   "metadata": { ... },
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
 *   ]
 * }
 */
export async function fetchProjectFromGitHub(reponame, sessionTemplate) {
  const project = {
    metadata: await importVariableFromGitHub(reponame, 'EVENT') ?? {},
    rooms: await importVariableFromGitHub(reponame, 'ROOMS') ?? [],
    days: await importVariableFromGitHub(reponame, 'DAYS') ?? [],
    slots: await importVariableFromGitHub(reponame, 'SLOTS') ?? [],
    sessions: await fetchSessions(reponame)
  };

  const schedule = await importVariableFromGitHub(reponame, 'SCHEDULE') ?? [];
  for (const row of schedule) {
    const meeting = {
      number: row[0],
      room: row[1],
      day: row[2],
      slot: row[3],
      meeting: row[4]
    };
    const session = project.sessions.find(s => s.number === meeting.number);
    if (session) {
      Object.assign(session, meeting);
    }
  }

  const validation = await importVariableFromGitHub(reponame, 'VALIDATION') ?? [];
  for (const session of project.sessions) {
    const value = validation.find(v => v.number === session.number);
    if (value) {
      delete value.number;
      session.validation = value;
    }
    else {
      session.validation = {
        check: null,
        warning: null,
        error: null,
        note: null
      };
    }
  }

  const registrants = await importVariableFromGitHub(reponame, 'REGISTRANTS') ?? [];
  for (const session of project.sessions) {
    const value = registrants.find(r => r.number === session.number);
    if (value) {
      delete value.number;
      session.registrants = value;
    }
    else {
      session.registrants = {
        participants: null,
        observers: null,
        url: null
      };
    }
  }

  project.allowMultipleMeetings = project.metadata?.type === 'groups';

  // Sections defined in the issue template
  project.sessionTemplate = sessionTemplate;
  project.sessionSections = getSessionSections(sessionTemplate);

  return project;
}


/**
 * Synchronize the project's data (event metadata, rooms, days, slots) with
 * GitHub.
 */
export async function exportProjectToGitHub(project, { what }) {
  const reponame = project.metadata.reponame;

  if (!what || what === 'all' || what === 'metadata') {
    await exportVariableToGitHub(reponame, 'EVENT', project.metadata);
    await exportVariableToGitHub(reponame, 'ROOMS', project.rooms);
    await exportVariableToGitHub(reponame, 'DAYS', project.days);
    await exportVariableToGitHub(reponame, 'SLOTS', project.slots);
  }

  if (!what || what === 'all' || what === 'schedule') {
    await exportSchedule(project);
  }

  if (!what || what === 'all' || what === 'schedule' || what === 'validation') {
    await exportValidation(project);
  }

  if (!what || what === 'all' || what === 'registrants') {
    await exportRegistrants(project);
  }
}


/**
 * Export the schedule to a GitHub variable.
 *
 * Note: variables on GitHub have a maximum length of 48000 characters,
 * we "compact" the schedule on purpose to avoid repeating keys.
 */
async function exportSchedule(project) {
  const schedule = project.sessions.map(session => [
    session.number,
    session.room,
    session.day,
    session.slot,
    session.meeting
  ]);
  await exportVariableToGitHub(project.metadata.reponame, 'SCHEDULE', schedule);
}


/**
 * Export validation notes to GitHub
 */
async function exportValidation(project) {
  const VALIDATION = [];
  for (const session of project.sessions) {
    VALIDATION.push(Object.assign({
      number: session.number
    }, session.validation));
  }
  await exportVariableToGitHub(project.metadata.reponame, 'VALIDATION', VALIDATION);
}


/**
 * Export session registrants to GitHub
 */
async function exportRegistrants(project) {
  const REGISTRANTS = [];
  for (const session of project.sessions) {
    REGISTRANTS.push(Object.assign({
      number: session.number
    }, session.registrants));
  }
  await exportVariableToGitHub(project.metadata.reponame, 'REGISTRANTS', REGISTRANTS);
}




/**
 * Validate that we have the information we need about the project.
 */
export function validateProject(project) {
  const errors = [];

  if (!project.metadata) {
    errors.push('The short description is missing. It should set the meeting, date, and timezone.');
  }
  else {
    if (!project.metadata.meeting) {
      errors.push('The "meeting" info in the short description is missing. Should be something like "meeting: TPAC 2023"');
    }
    if (!project.metadata.timezone) {
      errors.push('The "timezone" info in the short description is missing. Should be something like "timezone: Europe/Madrid"');
    }
    else if (!timezones.includes(project.metadata.timezone)) {
      errors.push('The "timezone" info in the short description is not a valid timezone. Value should be a "tz identifier" in https://en.wikipedia.org/wiki/List_of_tz_database_time_zones');
    }
    if (!['groups', 'breakouts', undefined].includes(project.metadata?.type)) {
      errors.push('The "type" info must be one of "groups" or "breakouts"');
    }
    if (project.metadata.calendar &&
        !['no', 'draft', 'tentative', 'confirmed'].includes(project.metadata.calendar)) {
      errors.push('The "calendar" info must be one of "no", "draft", "tentative" or "confirmed"');
    }
  }

  for (const slot of project.slots) {
    if (!slot.name.match(/^(\d+):(\d+)\s*-\s*(\d+):(\d+)$/)) {
      errors.push(`Invalid slot name "${slot.name}". Format should be "HH:mm - HH:mm"`);
    }
    if (slot.duration < 30 || slot.duration > 120) {
      errors.push(`Unexpected slot duration ${slot.duration}. Duration should be between 30 and 120 minutes.`);
    }
  }

  for (const day of project.days) {
    if (!day.date.match(/^\d{4}\-\d{2}\-\d{2}$/)) {
      errors.push(`Invalid day name "${day.name}". Format should be either "YYYY-MM-DD" or "[label] (YYYY-MM-DD)`);
    }
    else if (isNaN((new Date(day.date)).valueOf())) {
      errors.push(`Invalid date in day name "${day.name}".`);
    }
  }

  if (project.metadata?.type === 'groups') {
    if (project.days.length !== 4) {
      const s = project.days.length > 1 ? 's' : '';
      errors.push(`TPAC events should have 4 days of group meetings, ${project.days.length} day${s} found`);
    }
    else {
      const weekdays = project.days.map(day => day.label).sort().join(', ');
      if (weekdays !== 'Friday, Monday, Thursday, Tuesday') {
        errors.push(`TPAC event days should be a Monday, Tuesday, Thursday and Friday`);
      }
    }

    if (project.slots.length !== 4) {
      const s = project.slots.length > 1 ? 's' : '';
      errors.push(`TPAC events should have 4 slots per day, ${project.slots.length} slot${s} found`);
    }
  }

  return errors;
}


/**
 * Convert the project to a simplified JSON data structure
 * (suitable for tests but also for debugging)
 */
export function convertProjectToJSON(project) {
  const toNameList = list => list.map(item => item.name);
  const data = {
    title: project.title,
    metadata: project.metadata
  };
  for (const list of ['days', 'rooms', 'slots', 'labels']) {
    data[list] = toNameList(project[list]);
  }

  data.sessions = project.sessions.map(session => {
    const simplified = {
      number: session.number,
      title: session.title,
      author: session.author.login,
      body: session.body,
    };
    if (session.labels.length !== 1 || session.labels[0] !== 'session') {
      simplified.labels = session.labels;
    }
    for (const field of ['day', 'room', 'slot', 'meeting', 'registrants']) {
      if (session[field]) {
        simplified[field] = session[field];
      }
    }
    return simplified;
  });
  return data;
}


async function fetchSessions(reponame) {
  const repo = parseRepositoryName(reponame);
  const sessionsResponse = await sendGraphQLRequest(`query {
    ${repo.type}(login: "${repo.owner}") {
      repository(name: "${repo.name}") {
        issues(states: OPEN, first: 100) {
          nodes {
            id
            repository {
              owner {
                login
              }
              name
              nameWithOwner
            }
            number
            state
            title
            body
            labels(first: 20) {
              nodes {
                name
              }
            }
            author {
              ... on User {
                databaseId
              }
              login
            }
          }
        }
      }
    }
  }`);
  const sessions = sessionsResponse.data[repo.type].repository.issues.nodes;
  return sessions
    .filter(session => session.labels.nodes.find(label => label.name === 'session'))
    .map(session => Object.assign(session, {
      repository: session.repository.nameWithOwner,
      labels: session.labels.nodes.map(label => label.name)
    }));
}