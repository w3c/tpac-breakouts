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
