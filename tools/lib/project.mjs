import { sendGraphQLRequest } from './graphql.mjs';

/**
 * List of allowed timezone values.
 *
 * The list comes from running the following query on any W3C calendar entry:
 *
 *  [...document.querySelectorAll('#event_timezone option')]
 *   .map(option => option.getAttribute('value'))
 *   .filter(value => !!value);
 *
 * This query should return an array with >430 entries.
 */
const timezones = [
  'Pacific/Niue',
  'Pacific/Midway',
  'Pacific/Pago_Pago',
  'Pacific/Rarotonga',
  'Pacific/Honolulu',
  'Pacific/Johnston',
  'Pacific/Tahiti',
  'Pacific/Marquesas',
  'Pacific/Gambier',
  'America/Adak',
  'America/Anchorage',
  'America/Juneau',
  'America/Metlakatla',
  'America/Nome',
  'America/Sitka',
  'America/Yakutat',
  'Pacific/Pitcairn',
  'America/Hermosillo',
  'America/Mazatlan',
  'America/Creston',
  'America/Dawson_Creek',
  'America/Fort_Nelson',
  'America/Phoenix',
  'America/Santa_Isabel',
  'PST8PDT',
  'America/Los_Angeles',
  'America/Tijuana',
  'America/Vancouver',
  'America/Dawson',
  'America/Whitehorse',
  'America/Bahia_Banderas',
  'America/Belize',
  'America/Costa_Rica',
  'America/El_Salvador',
  'America/Guatemala',
  'America/Managua',
  'America/Merida',
  'America/Mexico_City',
  'America/Monterrey',
  'America/Regina',
  'America/Swift_Current',
  'America/Tegucigalpa',
  'Pacific/Galapagos',
  'America/Chihuahua',
  'MST7MDT',
  'America/Boise',
  'America/Cambridge_Bay',
  'America/Denver',
  'America/Edmonton',
  'America/Inuvik',
  'America/Yellowknife',
  'America/Eirunepe',
  'America/Rio_Branco',
  'CST6CDT',
  'America/North_Dakota/Beulah',
  'America/North_Dakota/Center',
  'America/Chicago',
  'America/Indiana/Knox',
  'America/Matamoros',
  'America/Menominee',
  'America/North_Dakota/New_Salem',
  'America/Rainy_River',
  'America/Rankin_Inlet',
  'America/Resolute',
  'America/Indiana/Tell_City',
  'America/Winnipeg',
  'America/Bogota',
  'Pacific/Easter',
  'America/Coral_Harbour',
  'America/Cancun',
  'America/Cayman',
  'America/Jamaica',
  'America/Panama',
  'America/Guayaquil',
  'America/Ojinaga',
  'America/Lima',
  'America/Boa_Vista',
  'America/Campo_Grande',
  'America/Cuiaba',
  'America/Manaus',
  'America/Porto_Velho',
  'America/Anguilla',
  'America/Antigua',
  'America/Aruba',
  'America/Barbados',
  'America/Blanc-Sablon',
  'America/Curacao',
  'America/Dominica',
  'America/Grenada',
  'America/Guadeloupe',
  'America/Kralendijk',
  'America/Lower_Princes',
  'America/Marigot',
  'America/Martinique',
  'America/Montserrat',
  'America/Port_of_Spain',
  'America/Puerto_Rico',
  'America/Santo_Domingo',
  'America/St_Barthelemy',
  'America/St_Kitts',
  'America/St_Lucia',
  'America/St_Thomas',
  'America/St_Vincent',
  'America/Tortola',
  'America/La_Paz',
  'America/Montreal',
  'America/Havana',
  'EST5EDT',
  'America/Detroit',
  'America/Grand_Turk',
  'America/Indianapolis',
  'America/Iqaluit',
  'America/Louisville',
  'America/Indiana/Marengo',
  'America/Kentucky/Monticello',
  'America/Nassau',
  'America/New_York',
  'America/Nipigon',
  'America/Pangnirtung',
  'America/Indiana/Petersburg',
  'America/Port-au-Prince',
  'America/Thunder_Bay',
  'America/Toronto',
  'America/Indiana/Vevay',
  'America/Indiana/Vincennes',
  'America/Indiana/Winamac',
  'America/Guyana',
  'America/Caracas',
  'America/Buenos_Aires',
  'America/Catamarca',
  'America/Cordoba',
  'America/Jujuy',
  'America/Argentina/La_Rioja',
  'America/Mendoza',
  'America/Argentina/Rio_Gallegos',
  'America/Argentina/Salta',
  'America/Argentina/San_Juan',
  'America/Argentina/San_Luis',
  'America/Argentina/Tucuman',
  'America/Argentina/Ushuaia',
  'Atlantic/Bermuda',
  'America/Glace_Bay',
  'America/Goose_Bay',
  'America/Halifax',
  'America/Moncton',
  'America/Thule',
  'America/Araguaina',
  'America/Bahia',
  'America/Belem',
  'America/Fortaleza',
  'America/Maceio',
  'America/Recife',
  'America/Santarem',
  'America/Sao_Paulo',
  'Antarctica/Palmer',
  'America/Punta_Arenas',
  'America/Santiago',
  'Atlantic/Stanley',
  'America/Cayenne',
  'America/Asuncion',
  'Antarctica/Rothera',
  'America/Paramaribo',
  'America/Montevideo',
  'America/St_Johns',
  'America/Noronha',
  'Atlantic/South_Georgia',
  'America/Miquelon',
  'America/Godthab',
  'Atlantic/Azores',
  'Atlantic/Cape_Verde',
  'America/Scoresbysund',
  'Etc/UTC',
  'Etc/GMT',
  'Africa/Abidjan',
  'Africa/Accra',
  'Africa/Bamako',
  'Africa/Banjul',
  'Africa/Bissau',
  'Africa/Conakry',
  'Africa/Dakar',
  'America/Danmarkshavn',
  'Europe/Dublin',
  'Africa/Freetown',
  'Europe/Guernsey',
  'Europe/Isle_of_Man',
  'Europe/Jersey',
  'Africa/Lome',
  'Europe/London',
  'Africa/Monrovia',
  'Africa/Nouakchott',
  'Africa/Ouagadougou',
  'Atlantic/Reykjavik',
  'Atlantic/St_Helena',
  'Africa/Sao_Tome',
  'Antarctica/Troll',
  'Atlantic/Canary',
  'Africa/Casablanca',
  'Africa/El_Aaiun',
  'Atlantic/Faeroe',
  'Europe/Lisbon',
  'Atlantic/Madeira',
  'Africa/Algiers',
  'Europe/Amsterdam',
  'Europe/Andorra',
  'Europe/Belgrade',
  'Europe/Berlin',
  'Europe/Bratislava',
  'Europe/Brussels',
  'Europe/Budapest',
  'Europe/Busingen',
  'Africa/Ceuta',
  'Europe/Copenhagen',
  'Europe/Gibraltar',
  'Europe/Ljubljana',
  'Arctic/Longyearbyen',
  'Europe/Luxembourg',
  'Europe/Madrid',
  'Europe/Malta',
  'Europe/Monaco',
  'Europe/Oslo',
  'Europe/Paris',
  'Europe/Podgorica',
  'Europe/Prague',
  'Europe/Rome',
  'Europe/San_Marino',
  'Europe/Sarajevo',
  'Europe/Skopje',
  'Europe/Stockholm',
  'Europe/Tirane',
  'Africa/Tunis',
  'Europe/Vaduz',
  'Europe/Vatican',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Zagreb',
  'Europe/Zurich',
  'Africa/Bangui',
  'Africa/Brazzaville',
  'Africa/Douala',
  'Africa/Kinshasa',
  'Africa/Lagos',
  'Africa/Libreville',
  'Africa/Luanda',
  'Africa/Malabo',
  'Africa/Ndjamena',
  'Africa/Niamey',
  'Africa/Porto-Novo',
  'Africa/Blantyre',
  'Africa/Bujumbura',
  'Africa/Gaborone',
  'Africa/Harare',
  'Africa/Juba',
  'Africa/Khartoum',
  'Africa/Kigali',
  'Africa/Lubumbashi',
  'Africa/Lusaka',
  'Africa/Maputo',
  'Africa/Windhoek',
  'Europe/Athens',
  'Asia/Beirut',
  'Europe/Bucharest',
  'Africa/Cairo',
  'Europe/Chisinau',
  'Asia/Famagusta',
  'Asia/Gaza',
  'Asia/Hebron',
  'Europe/Helsinki',
  'Europe/Kaliningrad',
  'Europe/Kiev',
  'Europe/Mariehamn',
  'Asia/Nicosia',
  'Europe/Riga',
  'Europe/Sofia',
  'Europe/Tallinn',
  'Africa/Tripoli',
  'Europe/Uzhgorod',
  'Europe/Vilnius',
  'Europe/Zaporozhye',
  'Asia/Jerusalem',
  'Africa/Johannesburg',
  'Africa/Maseru',
  'Africa/Mbabane',
  'Asia/Aden',
  'Asia/Baghdad',
  'Asia/Bahrain',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Riyadh',
  'Africa/Addis_Ababa',
  'Indian/Antananarivo',
  'Africa/Asmera',
  'Indian/Comoro',
  'Africa/Dar_es_Salaam',
  'Africa/Djibouti',
  'Africa/Kampala',
  'Indian/Mayotte',
  'Africa/Mogadishu',
  'Africa/Nairobi',
  'Asia/Amman',
  'Asia/Damascus',
  'Europe/Moscow',
  'Europe/Minsk',
  'Europe/Simferopol',
  'Europe/Kirov',
  'Antarctica/Syowa',
  'Europe/Istanbul',
  'Europe/Volgograd',
  'Asia/Tehran',
  'Asia/Yerevan',
  'Asia/Baku',
  'Asia/Tbilisi',
  'Asia/Dubai',
  'Asia/Muscat',
  'Indian/Mauritius',
  'Europe/Astrakhan',
  'Europe/Saratov',
  'Europe/Ulyanovsk',
  'Indian/Reunion',
  'Europe/Samara',
  'Indian/Mahe',
  'Asia/Kabul',
  'Asia/Almaty',
  'Asia/Qostanay',
  'Indian/Kerguelen',
  'Indian/Maldives',
  'Antarctica/Mawson',
  'Asia/Karachi',
  'Asia/Dushanbe',
  'Asia/Ashgabat',
  'Asia/Samarkand',
  'Asia/Tashkent',
  'Antarctica/Vostok',
  'Asia/Aqtau',
  'Asia/Aqtobe',
  'Asia/Atyrau',
  'Asia/Oral',
  'Asia/Qyzylorda',
  'Asia/Yekaterinburg',
  'Asia/Colombo',
  'Asia/Calcutta',
  'Asia/Katmandu',
  'Asia/Dhaka',
  'Asia/Thimphu',
  'Asia/Urumqi',
  'Indian/Chagos',
  'Asia/Bishkek',
  'Asia/Omsk',
  'Indian/Cocos',
  'Asia/Rangoon',
  'Indian/Christmas',
  'Antarctica/Davis',
  'Asia/Hovd',
  'Asia/Bangkok',
  'Asia/Saigon',
  'Asia/Phnom_Penh',
  'Asia/Vientiane',
  'Asia/Krasnoyarsk',
  'Asia/Novokuznetsk',
  'Asia/Novosibirsk',
  'Asia/Barnaul',
  'Asia/Tomsk',
  'Asia/Jakarta',
  'Asia/Pontianak',
  'Asia/Brunei',
  'Antarctica/Casey',
  'Asia/Makassar',
  'Asia/Macau',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Irkutsk',
  'Asia/Kuala_Lumpur',
  'Asia/Kuching',
  'Asia/Manila',
  'Asia/Singapore',
  'Asia/Taipei',
  'Asia/Ulaanbaatar',
  'Asia/Choibalsan',
  'Australia/Perth',
  'Australia/Eucla',
  'Asia/Dili',
  'Asia/Jayapura',
  'Asia/Tokyo',
  'Asia/Pyongyang',
  'Asia/Seoul',
  'Pacific/Palau',
  'Asia/Yakutsk',
  'Asia/Chita',
  'Asia/Khandyga',
  'Australia/Darwin',
  'Pacific/Guam',
  'Pacific/Saipan',
  'Pacific/Truk',
  'Antarctica/DumontDUrville',
  'Australia/Brisbane',
  'Australia/Lindeman',
  'Pacific/Port_Moresby',
  'Asia/Vladivostok',
  'Asia/Ust-Nera',
  'Australia/Adelaide',
  'Australia/Broken_Hill',
  'Australia/Currie',
  'Australia/Hobart',
  'Antarctica/Macquarie',
  'Australia/Melbourne',
  'Australia/Sydney',
  'Pacific/Kosrae',
  'Australia/Lord_Howe',
  'Asia/Magadan',
  'Asia/Srednekolymsk',
  'Pacific/Noumea',
  'Pacific/Bougainville',
  'Pacific/Ponape',
  'Asia/Sakhalin',
  'Pacific/Guadalcanal',
  'Pacific/Efate',
  'Asia/Anadyr',
  'Pacific/Fiji',
  'Pacific/Tarawa',
  'Pacific/Kwajalein',
  'Pacific/Majuro',
  'Pacific/Nauru',
  'Pacific/Norfolk',
  'Asia/Kamchatka',
  'Pacific/Funafuti',
  'Pacific/Wake',
  'Pacific/Wallis',
  'Pacific/Apia',
  'Pacific/Auckland',
  'Antarctica/McMurdo',
  'Pacific/Enderbury',
  'Pacific/Fakaofo',
  'Pacific/Tongatapu',
  'Pacific/Chatham',
  'Pacific/Kiritimati'
];


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
 * Record the meetings assignments for the provided session
 */
export async function saveSessionMeetings(session, project) {
  for (const field of ['room', 'day', 'slot', 'meeting']) {
    // Project may not allow multiple meetings
    if (!project[field + 'sFieldId']) {
      continue;
    }
    const prop = (field === 'meeting') ? 'text': 'singleSelectOptionId';
    let value = null;
    if (prop === 'text') {
      // Text field
      if (session[field]) {
        value = session[field];
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
    description: project.description
  };
  if (project.allowMultipleMeetings) {
    data.allowMultipleMeetings = true;
  }
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
    for (const field of ['day', 'room', 'slot', 'meeting']) {
      if (session[field]) {
        simplified[field] = session[field];
      }
    }
    return simplified;
  });
  return data;
}