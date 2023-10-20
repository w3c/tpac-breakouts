import { sendGraphQLRequest } from './graphql.mjs';

/**
 * Retrieve available project data.
 *
 * This includes:
 * - the list of rooms and their capacity
 * - the list of slots and their duration
 * - the detailed list of breakout sessions associated with the project
 * - the room and slot that may already have been associated with each session
 *
 * Returned object should look like:
 * {
 *   "title": "TPAC xxxx breakout sessions",
 *   "url": "https://github.com/organization/w3c/projects/xx",
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
 *         "login": "tidoust",
 *         "avatarUrl": "https://avatars.githubusercontent.com/u/1122927?v=4"
 *       },
 *       "createdAt": "2023-05-10T12:55:17Z",
 *       "updatedAt": "2023-05-10T13:12:11Z",
 *       "lastEditedAt": "2023-05-10T13:12:11Z",
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
  // Login is an organization name... or starts with "user/" to designate
  // a user project.
  const tokens = login.split('/');
  const type = (tokens.length === 2) && tokens[0] === 'user' ?
    'user' :
    'organization';
  login = (tokens.length === 2) ? tokens[1] : login;

  // Retrieve information about the list of rooms
  const roomsResponse = await sendGraphQLRequest(`query {
    ${type}(login: "${login}"){
      projectV2(number: ${id}) {
        id
        url
        title
        shortDescription
        field(name: "Room") {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              ... on ProjectV2SingleSelectFieldOption {
                id
                name
              }
            }
          }
        }
      }
    }
  }`);
  const project = roomsResponse.data[type].projectV2
  const rooms = project.field;

  // Similar request to list time slots
  const slotsResponse = await sendGraphQLRequest(`query {
    ${type}(login: "${login}"){
      projectV2(number: ${id}) {
        field(name: "Slot") {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              ... on ProjectV2SingleSelectFieldOption {
                id
                name
              }
            }
          }
        }
      }
    }
  }`);
  const slots = slotsResponse.data[type].projectV2.field;

  // Similar requests to get the ids of the custom fields used for validation
  const severityFieldIds = {};
  for (const severity of ['Error', 'Warning', 'Check', 'Note']) {
    const response = await sendGraphQLRequest(`query {
      ${type}(login: "${login}"){
        projectV2(number: ${id}) {
          field(name: "${severity}") {
            ... on ProjectV2FieldCommon {
              id
              name
            }
          }
        }
      }
    }`);
    severityFieldIds[severity] = response.data[type].projectV2.field.id;
  }

  // Another request to retrieve the list of sessions associated with the project.
  const sessionsResponse = await sendGraphQLRequest(`query {
    ${type}(login: "${login}") {
      projectV2(number: ${id}) {
        items(first: 100) {
          nodes {
            id
            content {
              ... on Issue {
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
                  avatarUrl
                }
                createdAt
                updatedAt
                lastEditedAt
              }
            }
            fieldValues(first: 10) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2SingleSelectField {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }`);
  const sessions = sessionsResponse.data[type].projectV2.items.nodes;

  const repository = sessions[0].content.repository;
  const labelsResponse = await sendGraphQLRequest(`query {
    repository(owner: "${repository.owner.login}", name: "${repository.name}") {
      labels(first: 50) {
        nodes {
          id
          name
        }
      }
    }
  }`);
  const labels = labelsResponse.data.repository.labels.nodes;

  // Let's combine and flatten the information a bit
  return {
    // Project's title and URL are more for internal reporting purpose.
    title: project.title,
    url: project.url,
    id: project.id,

    // Project's description should help us extract additional metadata:
    // - the date of the breakout sessions
    // - the timezone to use to interpret time slots
    // - the "big meeting" value to associate calendar entries to TPAC
    metadata: parseProjectDescription(project.shortDescription),

    // List of rooms. For each of them, we return the exact name of the option
    // for the "Room" custom field in the project (which should include the
    // room's capacity), the actual name of the room without the capacity, and
    // the room's capacity in number of seats.
    roomsFieldId: rooms.id,
    rooms: rooms.options.map(room => {
      const match =
        room.name.match(/(.*) \((\d+)\s*(?:\-\s*([^\)]+))?\)$/) ??
        [room.name, room.name, '30', undefined];
      return {
        id: room.id,
        name: match[0],
        label: match[1],
        location: match[3] ?? '',
        capacity: parseInt(match[2], 10)
      };
    }),

    // IDs of custom fields used to store validation problems
    severityFieldIds: severityFieldIds,

    // List of slots. For each of them, we return the exact name of the option
    // for the "Slot" custom field in the project, the start and end times and
    // the duration in minutes.
    slotsFieldId: slots.id,
    slots: slots.options.map(slot => {
      const times = slot.name.match(/^(\d+):(\d+)\s*-\s*(\d+):(\d+)$/) ??
        [null, '00', '00', '01', '00'];
      return {
        id: slot.id,
        name: slot.name,
        start: `${times[1]}:${times[2]}`,
        end: `${times[3]}:${times[4]}`,
        duration:
          (parseInt(times[3], 10) * 60 + parseInt(times[4], 10)) -
          (parseInt(times[1], 10) * 60 + parseInt(times[2], 10))
      };
    }),

    // List of open sessions linked to the project (in other words, all of the
    // issues that have been associated with the project). For each session, we
    // return detailed information, including its title, full body, author,
    // labels, and the room and slot that may already have been assigned.
    sessions: sessions
      .filter(session => session.content.state === 'OPEN')
      .map(session => {
        return {
          projectItemId: session.id,
          id: session.content.id,
          repository: session.content.repository.nameWithOwner,
          number: session.content.number,
          title: session.content.title,
          body: session.content.body,
          labels: session.content.labels.nodes.map(label => label.name),
          author: {
            databaseId: session.content.author.databaseId,
            login: session.content.author.login,
            avatarUrl: session.content.author.avatarUrl
          },
          createdAt: session.content.createdAt,
          updatedAt: session.content.updatedAt,
          lastEditedAt: session.content.lastEditedAt,
          room: session.fieldValues.nodes
            .find(value => value.field?.name === 'Room')?.name,
          slot: session.fieldValues.nodes
            .find(value => value.field?.name === 'Slot')?.name,
          validation: {
            check: session.fieldValues.nodes.find(value => value.field?.name === 'Check')?.text,
            warning: session.fieldValues.nodes.find(value => value.field?.name === 'Warning')?.text,
            error: session.fieldValues.nodes.find(value => value.field?.name === 'Error')?.text,
            note: session.fieldValues.nodes.find(value => value.field?.name === 'Note')?.text
          }
        };
      }),

      // Labels defined in the associated repository
      // (note all sessions should belong to the same repository!)
      labels: labels
  };
}


/**
 * Helper function to parse a project description and extract additional
 * metadata about breakout sessions: date, timezone, big meeting id
 *
 * Description needs to be a comma-separated list of parameters. Example:
 * "meeting: tpac2023, day: 2023-09-13, timezone: Europe/Madrid"
 */
function parseProjectDescription(desc) {
  const metadata = {};
  if (desc) {
    desc.split(/,/)
      .map(param => param.trim())
      .map(param => param.split(/:/).map(val => val.trim()))
      .map(param => metadata[param[0]] = param[1]);
  }
  return metadata;
}

/**
 * Record the slot and room assignment for the provided session
 */
export async function assignSessionsToSlotAndRoom(session, project) {
  const slot = project.slots.find(slot => session.slot === slot.name);
  const resSlot = await sendGraphQLRequest(`mutation {
    updateProjectV2ItemFieldValue(input: {
      clientMutationId: "mutatis mutandis",
      fieldId: "${project.slotsFieldId}",
      itemId: "${session.projectItemId}",
      projectId: "${project.id}",
      value: {
        singleSelectOptionId: "${slot.id}"
      }
    }) {
      clientMutationId
    }
  }`);
  if (!resSlot?.data?.updateProjectV2ItemFieldValue?.clientMutationId) {
    console.log(JSON.stringify(resSlot, null, 2));
    throw new Error(`GraphQL error, could not assign session #${session.number} to slot ${session.slot}`);
  }

  const room = project.rooms.find(room => session.room === room.name);
  const resRoom = await sendGraphQLRequest(`mutation {
    updateProjectV2ItemFieldValue(input: {
      clientMutationId: "mutatis mutandis",
      fieldId: "${project.roomsFieldId}",
      itemId: "${session.projectItemId}",
      projectId: "${project.id}",
      value: {
        singleSelectOptionId: "${room.id}"
      }
    }) {
      clientMutationId
    }
  }`);
  if (!resRoom?.data?.updateProjectV2ItemFieldValue?.clientMutationId) {
    console.log(JSON.stringify(resRoom, null, 2));
    throw new Error(`GraphQL error, could not assign session #${session.number} to room ${session.room}`);
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
    if (!project.metadata.date) {
      errors.push('The "date" info in the short description is missing. Should be something like "date: 2023-09-13"');
    }
    else if (!project.metadata.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      errors.push('The "date" info in the short description must follow the YYYY-MM-DD format');
    }
    if (!project.metadata.timezone) {
      errors.push('The "timezone" info in the short description is missing. Should be something like "timezone: Europe/Madrid"');
    }
  }

  for (const slot of project.slots) {
    if (!slot.name.match(/^(\d+):(\d+)\s*-\s*(\d+):(\d+)$/)) {
      errors.push(`Invalid slot name "${slot.name}". Format should be "HH:mm - HH:mm"`);
    }
    if (slot.duration !== 30 && slot.duration !== 60) {
      errors.push(`Unexpected slot duration ${slot.duration}. Duration should be 30 or 60 minutes.`);
    }
  }

  return errors;
}