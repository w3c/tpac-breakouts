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
 * - the list of days/slots and their duration
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
 *       "tracks": [ "media", ... ],
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
      meeting: row[4],
      tracks: row[5]
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
      session.participants = value.participants;
      session.observers = value.observers;
    }
    else {
      session.participants = 0;
      session.observers = 0;
    }
  }

  const people = await importVariableFromGitHub(reponame, 'PEOPLE') ?? [];
  for (const session of project.sessions) {
    const value = people.find(p => p.number === session.number);
    if (value) {
      session.people = value.people;
    }
    else {
      session.people = [];
    }
  }

  project.allowMultipleMeetings = project.metadata?.type === 'groups';

  // Sections defined in the issue template
  project.sessionTemplate = sessionTemplate;
  project.sessionSections = getSessionSections(sessionTemplate);

  return project;
}


/**
 * Synchronize the project's data (event metadata, rooms, slots) with
 * GitHub.
 */
export async function exportProjectToGitHub(project, { what }) {
  const reponame = project.metadata.reponame;

  if (!what || what === 'all' || what === 'metadata') {
    await exportVariableToGitHub(reponame, 'EVENT', project.metadata);
    await exportVariableToGitHub(reponame, 'ROOMS', project.rooms);
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
    await exportPeople(project);
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
    // Note: day used to be recorded separately from slot
    '',
    session.slot,
    session.meeting,
    session.tracks
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
    REGISTRANTS.push({
      number: session.number,
      participants: session.participants,
      observers: session.observers
    });
  }
  await exportVariableToGitHub(project.metadata.reponame, 'REGISTRANTS', REGISTRANTS);
}


/**
 * Export session people to GitHub
 */
async function exportPeople(project) {
  const PEOPLE = [];
  for (const session of project.sessions) {
    PEOPLE.push({
      number: session.number,
      people: session.people ?? []
    });
  }
  await exportVariableToGitHub(project.metadata.reponame, 'PEOPLE', PEOPLE);
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
    if (!slot.date.match(/^\d{4}\-\d{2}\-\d{2}$/)) {
      errors.push(`Invalid day name "${slot.date}" in slot. Format should be "YYYY-MM-DD"`);
    }
    else {
      if (!slot.start?.match(/^(\d+):(\d+)$/)) {
        errors.push(`Invalid slot start time "${slot.start}". Format should be "HH:mm"`);
      }
      if (!slot.end?.match(/^(\d+):(\d+)$/)) {
        errors.push(`Invalid slot end time "${slot.end}". Format should be "HH:mm"`);
      }
      if (slot.duration < 30 || slot.duration > 120) {
        errors.push(`Unexpected slot duration ${slot.duration}. Duration should be between 30 and 120 minutes.`);
      }
    }
  }

  if (project.metadata?.type === 'groups') {
    // TODO: these checks may prove too restrictive, as we may end up with
    // meetings on a Wednesday, or days with 3 or 5 slots.
    const weekdays = [...new Set(project.slots.map(day => day.weekday))]
      .sort()
      .join(', ');
    if (weekdays !== 'Friday, Monday, Thursday, Tuesday') {
      errors.push(`TPAC event days should be a Monday, Tuesday, Thursday and Friday`);
    }

    if (project.slots.length !== 16) {
      const s = project.slots.length > 1 ? 's' : '';
      errors.push(`TPAC events should have 16 slots in total, ${project.slots.length} slot${s} found`);
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

  data.rooms = toNameList(project.rooms);

  data.slots = project.slots.map(slot => {
    return {
      day: slot.day,
      start: slot.start,
      end: slot.end
    };
  });

  data.sessions = project.sessions.map(session => {
    const simplified = {
      number: session.number,
      title: session.title,
      author: session.author.login,
      body: session.body,
    };
    if (session.tracks?.length > 0) {
      simplified.tracks = session.tracks;
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


export function getProjectSlot(project, dayAndTime) {
  return project.slots.find(slot =>
    (slot.date + ' ' + slot.start) === dayAndTime);
}