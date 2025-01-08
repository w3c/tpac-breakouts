import { sendGraphQLRequest } from '../../common/graphql.mjs';
import { getEnvKey } from '../../common/envkeys.mjs';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as YAML from 'yaml';
import { parseProjectDescription } from '../../common/project.mjs';

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
                description
              }
            }
          }
        }
      }
    }
  }`);
  const project = roomsResponse.data[type].projectV2;
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

  // Similar request to list event days
  const daysResponse = await sendGraphQLRequest(`query {
    ${type}(login: "${login}"){
      projectV2(number: ${id}) {
        field(name: "Day") {
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
  const days = daysResponse.data[type].projectV2.field;

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

  // Project may also have a "Meeting" custom field when a session can be
  // scheduled multiple times. The field contains the list of (room, day, slot)
  // tuples that a session is associated with.
  const meetingResponse = await sendGraphQLRequest(`query {
    ${type}(login: "${login}"){
      projectV2(number: ${id}) {
        field(name: "Meeting") {
          ... on ProjectV2FieldCommon {
            id
            name
          }
        }
      }
    }
  }`);
  const meeting = meetingResponse.data[type].projectV2.field;

  // Project may also have a "Try me out" custom field to adjust the schedule
  const tryMeetingResponse = await sendGraphQLRequest(`query {
    ${type}(login: "${login}"){
      projectV2(number: ${id}) {
        field(name: "Try me out") {
          ... on ProjectV2FieldCommon {
            id
            name
          }
        }
      }
    }
  }`);
  const tryMeeting = tryMeetingResponse.data[type].projectV2.field;

  // And a "Registrants" custom field to record registrants to the session
  const registrantsResponse = await sendGraphQLRequest(`query {
    ${type}(login: "${login}"){
      projectV2(number: ${id}) {
        field(name: "Registrants") {
          ... on ProjectV2FieldCommon {
            id
            name
          }
        }
      }
    }
  }`);
  const registrants = registrantsResponse.data[type].projectV2.field;

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
                }
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

  let labels = [];
  if (sessions.length > 0) {
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
    labels = labelsResponse.data.repository.labels.nodes;
  }

  // Time to read the issue template that goes with the project
  // TODO: the template file should rather be passed as function parameter!
  const templateDefault = path.join('.github', 'ISSUE_TEMPLATE', 'session.yml');
  const templateFile = await getEnvKey('ISSUE_TEMPLATE', templateDefault);
  const templateYaml = await readFile(
    path.join(process.cwd(), templateFile),
    'utf8');
  const template = YAML.parse(templateYaml);
  const sessionSections = template.body
    .filter(section => !!section.id);

  // The "calendar" and "materials" sections are not part of the template.
  // They are added manually or automatically when need arises. For the
  // purpose of validation and serialization, we need to add them to the list
  // of sections (as custom "auto hide" sections that only get displayed when
  // they are not empty).
  sessionSections.push({
    id: 'calendar',
    attributes: {
      label: 'Links to calendar',
      autoHide: true
    }
  });
  sessionSections.push({
    id: 'materials',
    attributes: {
      label: 'Meeting materials',
      autoHide: true
    }
  });

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
    description: project.shortDescription,
    metadata: parseProjectDescription(project.shortDescription),

    // List of rooms. For each of them, we return the exact name of the option
    // for the "Room" custom field in the project. If the exact name can be
    // split into a room label, capacity in number of seats, location, and the
    // possible "vip" flag, then that information is used to initialize the
    // room's metadata. The room's full name should follow the pattern:
    //   "label (xx - location) (vip)"
    // Examples:
    //  Catalina (25)
    //  Utrecht (40 - 2nd floor)
    //  Main (120) (vip)
    //  Business (vip)
    //  Small (15)
    //  Plenary (150 - 18th floor) (vip)
    // The exact same information can be provided using actual metadata in the
    // description of the room, given as a list of key/value pairs such as:
    // - capacity: 40
    // - location: 2nd floor
    // Possible metadata keys are expected to evolve over time. If the
    // information is duplicated in the room name and in metadata, the
    // information in the room name will be used
    roomsFieldId: rooms.id,
    rooms: rooms.options.map(room => {
      const metadata = {};
      (room.description ?? '')
        .split(/\n/)
        .map(line => line.trim().replace(/^[*\-] /, '').split(/:\s*/))
        .filter(data => data[0] && data[1])
        .filter(data => data[0].toLowerCase() !== 'capacity' || data[1]?.match(/^\d+$/))
        .forEach(data => metadata[data[0].toLowerCase()] = data[1]);
      const match = room.name.match(/^(.*?)(?:\s*\((\d+)\s*(?:\-\s*([^\)]+))?\))?(?:\s*\((vip)\))?$/i);
      return Object.assign(metadata, {
        id: room.id,
        name: match[0],
        label: match[1],
        location: match[3] ?? metadata.location ?? '',
        capacity: parseInt(match[2] ?? metadata.capacity ?? '30', 10),
        vip: !!match[4] || (metadata.vip === 'true')
      });
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

    // List of days. For single-day events, there will be only one day, and
    // all sessions will be associated with it.
    daysFieldId: days.id,
    days: days.options.map(day => {
      const match =
        day.name.match(/(.*) \((\d{4}\-\d{2}\-\d{2})\)$/) ??
        [day.name, day.name, day.name];
      return {
        id: day.id,
        name: match[0],
        label: match[1],
        date: match[2]
      };
    }),

    // ID of the "Meeting" custom field, if it exists
    // (it signals the fact that sessions may be scheduled more than once)
    meetingsFieldId: meeting?.id,
    allowMultipleMeetings: !!meeting?.id,

    // ID of the "Try me out" custom field, if it exists
    // (it signals the ability to try schedule adjustments from GitHub)
    trymeoutsFieldId: tryMeeting?.id,
    allowTryMeOut: !!tryMeeting?.id,

    // ID of the "Registrants" custom field, if it exists
    // (it signals the ability to look at registrants to select rooms)
    // (note: the double "s" is needed because our convention was to make that
    // a plural of the custom field name, which happens to be a plural already)
    registrantssFieldId: registrants?.id,
    allowRegistrants: !!registrants?.id,

    // Sections defined in the issue template
    sessionSections,

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
            login: session.content.author.login
          },
          room: session.fieldValues.nodes
            .find(value => value.field?.name === 'Room')?.name,
          day: session.fieldValues.nodes
            .find(value => value.field?.name === 'Day')?.name,
          slot: session.fieldValues.nodes
            .find(value => value.field?.name === 'Slot')?.name,
          meeting: session.fieldValues.nodes
            .find(value => value.field?.name === 'Meeting')?.text,
          trymeout: session.fieldValues.nodes
            .find(value => value.field?.name === 'Try me out')?.text,
          registrants: session.fieldValues.nodes
            .find(value => value.field?.name === 'Registrants')?.text,
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
