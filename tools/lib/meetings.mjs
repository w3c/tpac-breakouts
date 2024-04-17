import * as YAML from 'yaml';

/**
 * Retrieve the list of meetings that the session is associated with.
 *
 * For breakouts, this should return at most one meeting, from the `day`,
 * `slot`, and `room` field values. For group meetings, the `day, `slot` and
 * `room` fields merely set "default" values, while actual meetings are in the
 * `meeting` field.
 */
export function parseSessionMeetings(session, project) {
  if (session.meeting) {
    return session.meeting.split(/;|\|/)
      .map(str => str.trim())
      .map(str => {
        const meeting = {
          room: session.room,
          day: session.day,
          slot: session.slot
        };
        str.split(',')
          .map(token => token.trim().toLowerCase())
          .forEach(token => {
            let found = false;
            for (const field of ['day', 'slot', 'room']) {
              const option = project[field + 's'].find(option =>
                option.name?.toLowerCase() === token ||
                option.label?.toLowerCase() === token ||
                option.date === token ||
                option.start === token);
              if (option) {
                meeting[field] = option.name;
                found = true;
                break;
              }
            }
            if (!found) {
              meeting.invalid = str;
              meeting.room = null;
              meeting.day = null;
              meeting.slot = null;
            }
          });
        return meeting;
      });
  }
  
  if (session.room || session.day || session.slot) {
    // One meeting at least partially scheduled
    return [{
      room: session.room,
      day: session.day,
      slot: session.slot
    }];
  }

  return [];
}


/**
 * Group meetings by contiguous slots to create a minimum number of calendar
 * entries for group meetings.
 */
export function groupSessionMeetings(session, project) {
  const slots = project.slots;
  const meetings = parseSessionMeetings(session, project);

  // First, group the meetings by room and day
  const groups = {};
  for (const meeting of meetings) {
    if (meeting.room && meeting.day && meeting.slot) {
      const key = meeting.room + ', ' + meeting.day;
      const slotIndex = project.slots.findIndex(s => s.name === meeting.slot);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(meeting);
    }
  }

  // Then sort slots within each group
  for (const group of Object.values(groups)) {
    group.sort((m1, m2) => {
      const slot1 = project.slots.findIndex(s => s.name === m1.slot);
      const slot2 = project.slots.findIndex(s => s.name === m2.slot);
      return slot1 - slot2;
    });
  }

  // And now merge contiguous slots
  const list = Object.values(groups)
    .map(group => group.reduce((merged, meeting) => {
      const slot = project.slots.find(s => s.name === meeting.slot);
      const slotIndex = project.slots.findIndex(s => s.name === meeting.slot);
      if (merged.length === 0) {
        merged.push({
          start: slot.start,
          end: slot.end,
          startIndex: slotIndex,
          endIndex: slotIndex,
          meetings: [meeting]
        });
      }
      else {
        const last = merged[merged.length - 1];
        if (slotIndex === last.endIndex + 1) {
          last.end = slot.end;
          last.endIndex = slotIndex;
          last.meetings.push(meeting);
        }
        else {
          merged.push({
            start: slot.start,
            end: slot.end,
            startIndex: slotIndex,
            endIndex: slotIndex,
            meetings: [meeting]
          });
        }
      }
      return merged;
    }, []))
    .flat()
    .map(entry => Object.assign({
      room: entry.meetings[0].room,
      day: entry.meetings[0].day,
      start: entry.start,
      end: entry.end
    }));

  return list;
}


/**
 * Return the list of actions that should be applied to the calendar to
 * synchronize it with the session's (grouped) meetings.
 *
 * The function returns an object with "create", "update", "cancel" properties.
 * The "create" property contains the list of calendar entries to create. The
 * "update" property contains the list of calendar entries to refresh. The
 * "cancel" property contains the list of calendar entries to cancel, delete,
 * (or remove the session from for plenary entries).
 */
export function computeSessionCalendarUpdates(session, project) {
  // Compute the list of calendar entries that we need
  const meetings = groupSessionMeetings(session, project);

  // Retrieve info about calendar entries that are already associated with the
  // session from the session description
  const entries = (session.description.calendar ?? [])
    .map(entry => {
      const day = project.days.find(day =>
        day.name?.toLowerCase() === entry.day.toLowerCase() ||
        day.label?.toLowerCase() === entry.day.toLowerCase() ||
        day.date === entry.day);
      entry.day = day.name;
      return entry;
    });

  // Diff both lists
  const updates = {
    create: [],
    update: [],
    cancel: []
  };

  // TODO: handle assignment to an existing plenary (retrieving the plenary
  // entry from other sessions in the same plenary)
  // TODO: reuse plenary entry when session day/slot changes and session was
  // the only one in the plenary entry so far.
  // TODO: reuse plenary entry when session switches to breakout and was the
  // only one in the plenary entry so far.

  for (const meeting of meetings) {
    let entry = entries.find(entry =>
      entry.day === meeting.day &&
      entry.start === meeting.start &&
      entry.end === meeting.end &&
      (entry.type === 'plenary' || session.description.type !== 'plenary')
    );
    if (entry) {
      entry.meeting = meeting;
      updates.update.push(entry);
    }
    else {
      entry = {
        day: meeting.day,
        start: meeting.start,
        end: meeting.end,
        meeting
      };
      if (session.description.type === 'plenary') {
        entry.type = 'plenary';
      }
      updates.create.push(entry);
    }
  }

  for (const entry of entries) {
    if (!entry.meeting) {
      if (!entry.plenary) {
        const tocreate = updates.create.pop();
        if (tocreate) {
          tocreate.url = entry.url;
          updates.update.push(tocreate);
        }
        else {
          updates.cancel.push(entry);
        }
      }
      else {
        updates.cancel.push(entry);
      }
    }
  }

  return updates;
}


/**
 * Return true if session meets at the specified meeting
 */
export function meetsAt(session, meeting, project) {
  const meetings = parseSessionMeetings(session, project);
  return !!meetings.find(m =>
    m.room === meeting.room &&
    m.day === meeting.day &&
    m.slot === meeting.slot);
}


/**
 * Return true if session meets in parallel with the specified meeting
 */
export function meetsInParallelWith(session, meeting, project) {
  const meetings = parseSessionMeetings(session, project);
  return !!meetings.find(m =>
    ((m.room && meeting.room && m.room !== meeting.room) ||
      !m.room ||
      !meeting.room) &&
    m.day === meeting.day &&
    m.slot === meeting.slot);
}


/**
 * Parse a list of meetings changes defined in a YAML string.
 *
 * Meeting changes are used to apply local changes to a schedule.
 */
export function parseMeetingsChanges(yaml) {
  const resources = ['room', 'day', 'slot', 'meeting'];
  const yamlChanges = YAML.parse(yaml);
  return Object.entries(yamlChanges).map(([number, yamlChange]) => {
    if (!number.match(/^\d+$/)) {
      throw new Error(`Invalid meetings changes: #${number} is not a session number`);
    }
    const change = {
      number: parseInt(number, 10)
    };
    for (const [key, value] of Object.entries(yamlChange)) {
      if (!['reset', 'room', 'day', 'slot', 'meeting'].includes(key)) {
        throw new Error(`Invalid meetings changes for #${number}: "${key}" is an unexpected key`);
      }
      switch (key) {
      case 'reset':
        if (value === 'all') {
          change[key] = resources.slice();
        }
        else if (Array.isArray(value)) {
          if (value.find(val => !resources.includes(val))) {
            throw new Error(`Invalid meetings changes for #${number}: "${key}" values "${value.join(', ')}" contains an unexpected field`);
          }
          change[key] = value;
        }
        else if (!resources.includes(value)) {
          throw new Error(`Invalid meetings changes for #${number}: "${key}" value "${value}" is unexpected`);
        }
        else {
          change[key] = [value];
        }
        break;

      case 'room':
      case 'day':
      case 'slot':
        if (typeof value !== 'string') {
          throw new Error(`Invalid meetings changes for #${number}: "${key}" value is not a string`);
        }
        change[key] = value;
        break;

      case 'meeting':
        if (Array.isArray(value)) {
          if (value.find(val => typeof val !== 'string' ||
                                val.includes(';') ||
                                val.includes('|'))) {
            throw new Error(`Invalid meetings changes for #${number}: "${key}" value is not an array of individual meeting strings`);
          }
          change[key] = value.join('; ');
        }
        else if (typeof value !== 'string') {
          throw new Error(`Invalid meetings changes for #${number}: "${key}" value is not a string`);
        }
        else {
          change[key] = value;
        }
      }
    }
    return change;
  });
}


/**
 * Apply the list of meetings changes to the given list of sessions.
 *
 * Sessions are updated in place. The sessions that are effectively updated
 * also get an `updated` flag.
 *
 * The list of meetings changes must follow the structure returned by the
 * previous parseMeetingsChanges function.
 */
export function applyMeetingsChanges(sessions, changes) {
  for (const change of changes) {
    const session = sessions.find(s => s.number === change.number);
    if (!session) {
      throw new Error(`Invalid change requested: #${change.number} does not exist`);
    }
    if (change.reset) {
      for (const field of change.reset) {
        if (session[field]) {
          delete session[field];
          session.updated = true;
        }
      }
    }
    for (const field of ['room', 'day', 'slot', 'meeting']) {
      if (change[field] && change[field] !== session[field]) {
        session[field] = change[field];
        session.updated = true;
      }
    }
  }
}