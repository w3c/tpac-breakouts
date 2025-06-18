import { getProjectSlot } from './project.mjs';

/**
 * Normalize times for comparison purpose, making sure that hours always have
 * two digits: from 9:00 to 09:00
 */
function padTime(time) {
  if (!time) {
    return null;
  }
  return (time.length === 4) ? '0' + time : time;
}

/**
 * Validate the actual start/end times of a meeting slot
 */
function validateActualTimes(meeting, project) {
  const slots = project.slots;
  const actualStart = padTime(meeting.actualStart);
  const actualEnd = padTime(meeting.actualEnd);
  const slotIndex = slots.findIndex(s =>
    (!meeting.day || s.date === meeting.day) &&
    s.start === meeting.slot);
  const slot = slots[slotIndex];
  let previous = slotIndex > 0 ? slots[slotIndex - 1] : null;
  if (previous && previous.date !== slot.date) {
    previous = null;
  }
  let next = slotIndex < slots.length - 1 ? slots[slotIndex + 1] : null;
  if (next && next.date !== slot.date) {
    next = null;
  }
  if (actualStart) {
    if (actualStart === padTime(slot.start)) {
      // Actual start time is useless since it matches the slot's start time
      return false;
    }
    else if (actualStart >= padTime(slot.end)) {
      // Actual start time makes no sense
      return false;
    }
    else if (previous && actualStart < padTime(previous.end)) {
      // Actual start time overlaps with previous slot
      return false;
    }
  }
  if (actualEnd) {
    if (actualEnd === padTime(slot.end)) {
      // Actual end time is useless since it matches the slot's end time
      return false;
    }
    else if (actualEnd <= padTime(slot.start)) {
      // Actual end time makes no sense
      return false;
    }
    else if (next && actualEnd > padTime(next.start)) {
      // Actual end time overlaps with next slot
      return false;
    }
  }
  if (actualStart && actualEnd && actualStart > actualEnd) {
    // Actual start/end times do not make sense
    return false;
  }
  return true;
}

/**
 * Retrieve the list of meetings that the session is associated with.
 *
 * For breakouts, this should return at most one meeting, from the `day`,
 * `slot`, and `room` field values. For group meetings, the `day, `slot` and
 * `room` fields merely set "default" values, while actual meetings are in the
 * `meeting` field.
 */
export function parseSessionMeetings(session, project) {
  const sessionSlot = getProjectSlot(project, session.slot);
  if (session.meeting) {
    return session.meeting.split(/;|\|/)
      .map(str => str.trim())
      .map(str => {
        const meeting = {
          room: session.room,
          day: sessionSlot?.date,
          slot: sessionSlot?.start
        };
        str.split(',')
          .map(token => token.trim().toLowerCase())
          .forEach(token => {
            if (meeting.invalid) {
              return;
            }
            // For rooms and days, the token is either going to be the option's
            // name, or its weekday, e.g., "2020-02-10" or "Monday".
            // For slots, this can be the full name, the start time, or either
            // of them completed with an actual start and/or end time. For
            // example: "9:00", "9:00<8:30>", "9:00-11:00", "9:00-11:00<10:30>"
            // or "9:00<8:30> - 11:00<10:30>". The syntax is captured by the
            // following regular expression, which returns the slot's
            // start (1), actual start (2), end (3) and actual end (4) times.
            const slotMatch = token.match(
              /^(\d+:\d+)(?:<(\d+:\d+)>)?(?:\s*-\s*(\d+:\d+)(?:<(\d+:\d+)>)?)?$/);
            if (slotMatch) {
              const option = project.slots.find(option =>
                padTime(option.start) === padTime(slotMatch[1]) &&
                (!slotMatch[3] || padTime(option.end) === padTime(slotMatch[3])));
              if (option) {
                meeting.slot = option.start;
                if (slotMatch[2]) {
                  meeting.actualStart = slotMatch[2];
                }
                if (slotMatch[4]) {
                  meeting.actualEnd = slotMatch[4];
                }
                if (!validateActualTimes(meeting, project)) {
                  meeting.invalid = str;
                  if (meeting.actualStart) {
                    delete meeting.actualStart;
                  }
                  if (meeting.actualEnd) {
                    delete meeting.actualEnd;
                  }
                }
                return;
              }
            }
            else {
              let option = project.rooms.find(option =>
                option.name?.toLowerCase() === token);
              if (option) {
                meeting.room = option.name;
                return;
              }
              option = project.slots.find(slot =>
                slot.date === token ||
                slot.weekday.toLowerCase() === token); 
              if (option) {
                meeting.day = option.date;
                return;
              }
            }

            // Still there? Token could not be mapped to an option
            meeting.invalid = str;
            return;
          });
        if (meeting.invalid || !meeting.room) {
          delete meeting.room;
        }
        if (meeting.invalid || !meeting.day) {
          delete meeting.day;
        }
        if (meeting.invalid || !meeting.slot) {
          delete meeting.slot;
        }
        return meeting;
      });
  }
  
  if (session.room || sessionSlot) {
    // One meeting at least partially scheduled
    const meeting = {};
    if (session.room) {
      meeting.room = session.room;
    }
    if (sessionSlot) {
      meeting.day = sessionSlot.date;
      meeting.slot = sessionSlot.start;
    }
    return [meeting];
  }

  return [];
}


/**
 * Serialize the list of meetings to a `meeting` field string.
 *
 * The function uses labels when possible instead of full names to increase
 * readability of the resulting string.
 *
 * The function actually returns an object with `room` and `meeting`
 * properties. The `room` property is set to the full name of the room if all
 * meetings take place in the same room. When that happens, the `meeting` value
 * will not contain any information about the room.
 *
 * The `room` property is not set otherwise
 */
export function serializeSessionMeetings(meetings, project) {
  if (!meetings || meetings.length === 0) {
    return {};
  }
  const room = meetings.reduce((room, meeting) => {
    return (meeting.room && meeting.room === room) ? room : null;
  }, meetings[0].room);
  const res = {};
  if (room) {
    res.room = room;
  }
  res.meeting = meetings
    .map(meeting => {
      const tokens = [];
      if (meeting.day) {
        const day = project.slots.find(slot => slot.date === meeting.day);
        tokens.push(day.weekday ?? day.name);
      }
      if (meeting.slot) {
        const slot = project.slots.find(slot => slot.start === meeting.slot);
        if (meeting.actualEnd) {
          if (meeting.actualStart) {
            tokens.push(`${slot.start}<${meeting.actualStart}> - ${slot.end}<${meeting.actualEnd}>`);
          }
          else {
            tokens.push(`${slot.start} - ${slot.end}<${meeting.actualEnd}>`);
          }
        }
        else if (meeting.actualStart) {
          tokens.push(`${slot.start}<${meeting.actualStart}>`);
        }
        else {
          tokens.push(slot.start);
        }
      }
      if (meeting.room && !room) {
        const roomObj = project.rooms.find(room => room.name === meeting.room);
        tokens.push(roomObj.name);
      }
      return tokens.join(', ');
    })
    .join('; ');
  return res;
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
      const slotIndex = project.slots.findIndex(s => s.start === meeting.slot);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(meeting);
    }
  }

  // Then sort slots within each group
  for (const group of Object.values(groups)) {
    group.sort((m1, m2) => {
      const slot1 = project.slots.findIndex(s => s.start === m1.slot);
      const slot2 = project.slots.findIndex(s => s.start === m2.slot);
      return slot1 - slot2;
    });
  }

  // And now merge contiguous slots
  const list = Object.values(groups)
    .map(group => group.reduce((merged, meeting) => {
      const slot = project.slots.find(s => s.start === meeting.slot);
      const slotIndex = project.slots.findIndex(s => s.start === meeting.slot);
      if (merged.length === 0) {
        merged.push({
          start: meeting.actualStart ?? slot.start,
          end: meeting.actualEnd ?? slot.end,
          startIndex: slotIndex,
          endIndex: slotIndex,
          meetings: [meeting]
        });
      }
      else {
        const last = merged[merged.length - 1];
        if (slotIndex === last.endIndex + 1) {
          last.end = meeting.actualEnd ?? slot.end;
          last.endIndex = slotIndex;
          last.meetings.push(meeting);
        }
        else {
          merged.push({
            start: meeting.actualStart ?? slot.start,
            end: meeting.actualEnd ?? slot.end,
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
      const day = project.slots.find(slot =>
        slot.date === entry.day ||
        slot.weekday.toLowerCase() === entry.day.toLowerCase());
      entry.day = day.date;
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
    (!meeting.room || m.room === meeting.room) &&
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
 * Return true if session meets in the given room
 */
export function meetsInRoom(session, room, project) {
  const meetings = parseSessionMeetings(session, project);
  return !!meetings.find(m => m.room === room);
}
