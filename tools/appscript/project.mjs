import { getEnvKey } from '../common/envkeys.mjs';
import * as YAML from '../../node_modules/yaml/browser/index.js';

/**
 * Retrieve an indexed object that contains the list of sheets associated with
 * the event/project.
 */
export function getProjectSheets(spreadsheet) {
  // These are the sheets we expect to find in the spreadsheet
  const sheets = {
    grid: {},
    event: { titleMatch: /event/i },
    sessions: { titleMatch: /list/i },
    meetings: { titleMatch: /meetings/i },
    rooms: { titleMatch: /rooms/i },
    days: { titleMatch: /days/i },
    slots: { titleMatch: /slots/i }
  };

  // Retrieve the sheets from the spreadsheet
  // (we'll consider that the grid view is the first sheet we find that isn't one of the
  // other well-known sheets. That gives some leeway as to how the sheet gets named.)
  for (const sheet of spreadsheet.getSheets()) {
    const name = sheet.getName().toLowerCase();
    const desc = Object.values(sheets).find(s => s.titleMatch?.test(name));
    if (desc) {
      desc.sheet = sheet;
      desc.values = getValues(sheet);
    }
    else if (!sheets.grid.sheet) {
      sheets.grid.sheet = sheet;
      sheets.grid.values = getValues(sheet);
    }
  }

  // Do we have all we need?
  if (!sheets.grid.sheet) {
    reportError('No "Grid view" sheet found, please add one and start again.');
    return;
  }
  if (!sheets.event.sheet) {
    reportError('No "Event" sheet found, please add one and start again.');
    return;
  }
  if (!sheets.rooms.sheet) {
    reportError('No "Rooms" sheet found, please import data from GitHub first.');
    return;
  }
  if (!sheets.days.sheet) {
    reportError('No "Days" sheet found, please import data from GitHub first.');
    return;
  }
  if (!sheets.slots.sheet) {
    reportError('No "Slots" sheet found, please import data from GitHub first.');
    return;
  }

  // The "Sessions" and "Meetings" sheets may be created afterwards, no error
  // to report if they do not exist.

  // No "Meetings" sheet for breakouts sessions? That's normal, there's a 1:1
  // relationship between breakout sessions and meetings, the sessions sheet
  // already contains the expanded view. 
  if (sheets.sessions.sheet && !sheets.meetings.sheet) {
    sheets.meetings.sheet = sheets.sessions.sheet;
    sheets.meetings.values = sheets.sessions.values;
  }

  return sheets;
}


/**
 * Load event/project metadata from the spreadsheet and return an object whose
 * structure matches the structure returned by the GitHub version of the code:
 *
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
export function getProject(spreadsheet) {
  const sheets = getProjectSheets(spreadsheet);
  const metadata = sheets.event.values;

  function getSetting(name, defaultValue = null) {
    const value = metadata.find(v => v.parameter === name)?.value;
    return !!value ? value : defaultValue;
  }

  // Parse YAML GitHub issue template if it exists
  let sessionSections = [];
  const yamlTemplate = getSetting('GitHub issue template');
  if (yamlTemplate) {
    const template = YAML.parse(yamlTemplate);
    sessionSections = template.body.filter(section => !!section.id);

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
  }

  const project = {
    title: spreadsheet.getName(),
    url: getSetting('GitHub project URL', ''),
    metadata: {
      type: getSetting('Type', 'breakouts'),
      timezone: getSetting('Timezone', 'Etc/UTC'),
      calendar: getSetting('Sync with W3C calendar', 'no'),
      rooms: getSetting('Show rooms in calendar') === 'no' ? 'hide' : 'show',
      meeting: getSetting('Meeting name in calendar', ''),
      reponame: getSetting('GitHub repository name')
    },

    rooms: sheets.rooms.values.filter(v => !!v.name),

    days: sheets.days.values
      .filter(v => !!v.date)
      .map(v => {
        const name = v.weekday ?
          v.weekday + ' (' + v.date + ')' :
          v.date;
        return {
          id: v.id,
          name,
          label: !!v.weekday ? v.weekday : v.date,
          date: v.date
        };
      }),

    slots: sheets.slots.values
      .filter(v => !!v['start time'] && !!v['end time'])
      .map(v => {
        const name = v['start time'] + ' - ' + v['end time'];
        const times =
          name.match(/^(\d+):(\d+)\s*-\s*(\d+):(\d+)$/) ??
          [null, '00', '00', '01', '00'];
        return {
          id: v.id,
          start: v['start time'],
          end: v['end time'],
          name,
          duration:
            (parseInt(times[3], 10) * 60 + parseInt(times[4], 10)) -
            (parseInt(times[1], 10) * 60 + parseInt(times[2], 10))
        };
      }),

    allowMultipleMeetings: getSetting('Type') === 'group',
    allowTryMeOut: false,
    allowRegistrants: false,

    sessionSections,

    // TODO: how to retrieve the labels?
    labels: [],

    // TODO: initialize from sessions sheet if it exists
    // TODO: complete with meetings sheet if it exists
    sessions: []
  };

  return project;
}


/**
 * Return the values in a sheet as a list of objects whose property names are
 * derived from the header row.
 */
function getValues(sheet) {
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const values = rows.slice(1).map(row => {
    const value = {};
    for (let i = 0; i < headers.length; i++) {
      let content = row[i];
      if (typeof row[i] === 'string') {
        content = content.trim();
      }
      else if (row[i] instanceof Date) {
        const year = row[i].getFullYear();
        const month = row[i].getMonth() + 1;
        const day = row[i].getDate();
        content = '' + year + '-' +
          (month < 10 ? '0' : '') + month + '-' +
          (day < 10 ? '0' : '') + day;
      }
      if (content === '') {
        content = null;
      }
      value[headers[i].toLowerCase()] = content;
    }
    return value;
  });
  return values;
}