/**
 * Helper library to suggest a schedule that takes as many constraints as
 * possible into account.
 *
 * Assumptions:
 * - All rooms are of equal quality
 * - Some slots may be seen as preferable
 *
 * Goals:
 * - Where possible, sessions that belong to the same track should take place
 * in the same room. Because a session may belong to two tracks, this is not
 * an absolute goal.
 * - Schedule sessions back-to-back to avoid gaps.
 * - Favor minimizing travels over using different rooms.
 * - Session issue number should not influence slot and room (early proponents
 * should not be favored or disfavored).
 * - Minimize the number of rooms used in parallel.
 * - Only one session labeled for a given track at the same time.
 * - Only one session with a given chair at the same time.
 * - No identified conflicting sessions at the same time.
 * - Meet duration preference.
 * - Meet capacity preference.
 *
 * The tool schedules as many sessions as possible, skipping over sessions that
 * it cannot schedule due to a confict that it cannot resolve.
 */

import seedrandom from 'seedrandom';
import { parseSessionMeetings,
         serializeSessionMeetings,
         meetsInParallelWith,
         meetsInRoom,
         meetsAt } from './meetings.mjs';

/**
 * Helper function to shuffle an array
 */
function shuffle(array, seed) {
  const randomGenerator = seedrandom(seed);
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(randomGenerator.quick() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}


/**
 * Suggest a schedule, updated sessions meetings as needed.
 *
 * The function updates the sessions in place, setting `room`, `day`, `slot`
 * and/or `meeting` as needed.
 *
 * The function sets an `updated` flag on sessions it actually updated.
 *
 * The seed is used to shuffle the list of sessions. If not given, the list is
 * shuffled randomly. Shuffling will yield the same result if seed is given,
 * allowing to re-run the function and get the same results.
 */
export function suggestSchedule(project, { seed }) {
  const plenaryRoom = project.metadata['plenary room'] ?? 'Plenary';
  let plenaryHolds;
  if (project.metadata['plenary holds']?.match(/^\d+$/)) {
    plenaryHolds = parseInt(project.metadata['plenary holds'], 10);
  }
  else {
    plenaryHolds = 5;
  }

  // Shuffle sessions
  seed = seed ?? makeseed();
  let sessions = project.sessions.slice();
  shuffle(sessions, seed);
  console.warn(`- shuffled sessions with seed "${seed}" to: ${sessions.map(s => s.number).join(', ')}`);

  // Filter out invalid sessions
  sessions = sessions.filter(session =>
    !session.blockingErrors ||
    (session.blockingErrors.length === 0));

  // Initialize the list of tracks
  // Note: for the purpose of scheduling, a "_plenary" track gets artificially
  // created so that plenary sessions get scheduled first. That's needed to
  // avoid scheduling breakout sessions in parallel to plenary sessions.
  // Last track in the list is "no track".
  const tracks = new Set();
  tracks.add('_plenary');
  for (const session of sessions) {
    session.tracks = session.labels
      .filter(label => label.startsWith('track: '))
      .map(label => label.substring('track: '.length))
      .map(track => {
        tracks.add(track);
        return track;
      });
  }
  tracks.add('');

  // Initialize the current list of meetings associated with each session
  for (const session of sessions) {
    session.meetings = parseSessionMeetings(session, project);
  }

  // Initalize the list of days and slots and the occupation views
  const daysAndSlots = [];
  let pos = 0;
  for (const day of project.days) {
    for (const slot of project.slots) {
      const meeting = {
        day: day.name,
        slot: slot.name
      };
      daysAndSlots.push({
        day, slot,
        pos,
        sessions: sessions.filter(session =>
          meetsInParallelWith(session, meeting, project))
      });
      pos += 1;
    }
  }

  // Same thing for the list of rooms
  const rooms = project.rooms
    .map((room, pos) => Object.assign({}, room, {
      pos,
      sessions: sessions.filter(session =>
        meetsInRoom(session, room, project))
    }));

  // Return next session to process (and flag it as processed)
  function selectNextSession(track) {
    const session = sessions.find(s => !s.processed &&
      ((track === '_plenary' && s.description.type === 'plenary') ||
        track === '' ||
        s.tracks.includes(track)));
    if (session) {
      session.processed = true;
    }
    return session;
  }

  // Helper function to choose a room for the given track.
  // The function returns null when track represents the main track.
  function chooseTrackRoom(track) {
    if (track === '_plenary') {
      // Plenary room is imposed
      return rooms.find(room => room.name === plenaryRoom);
    }
    if (!track) {
      // No specific room by default for sessions in the main track
      return null;
    }
    const trackSessions = sessions.filter(s => s.tracks.includes(track));

    // Find the session in the track that requires the largest room
    const largestSession = trackSessions.reduce(
      (smax, scurr) => (scurr.description.capacity > smax.description.capacity) ? scurr : smax,
      trackSessions[0]
    );

    const slotsTaken = room => room.sessions.reduce(
      (total, curr) => curr.track === track ? total : total + 1,
      0);
    const byAvailability = (r1, r2) => slotsTaken(r1) - slotsTaken(r2);
    const meetCapacity = room => room.capacity >= largestSession.description.capacity;
    const meetSameRoom = room => slotsTaken(room) + trackSessions.length <= daysAndSlots.length;
    const meetAll = room => meetCapacity(room) && meetSameRoom(room);

    const requestedRoomsSet = new Set();
    trackSessions
      .filter(s => s.room)
      .forEach(s => requestedRoomsSet.add(s.room));
    const requestedRooms = [...requestedRoomsSet]
      .map(name => rooms.find(room => room.name === name));
    const allRooms = []
      .concat(requestedRooms.sort(byAvailability))
      .concat(rooms.filter(room =>
        room.name !== plenaryRoom &&
        !requestedRooms.includes(room)).sort(byAvailability));
    const room =
      allRooms.find(meetAll) ??
      allRooms.find(meetCapacity) ??
      allRooms.find(meetSameRoom) ??
      allRooms[0];
    return room;
  }

  function isMeetingAvailableForSession(session, meeting) {
    if (session.description.type === 'plenary') {
      const alreadyScheduled = sessions.filter(s =>
        s !== session && meetsAt(s, meeting));
      return !alreadyScheduled.find(s => s.description.type !== 'plenary') &&
        (alreadyScheduled.length < plenaryHolds);
    }
    else {
      return !sessions.find(s => s !== session && meetsAt(s, meeting)) &&
             !sessions.find(s => s !== session &&
                                 s.description.type === 'plenary' &&
                                 meetsInParallelWith(s, meeting));
    }
  }

  function chooseSessionMeetings(session, {
    trackRoom, numberOfMeetings, strictDuration, strictTimes,
    meetDuration, meetCapacity, meetConflicts
  }) {
    const byCapacity = (r1, r2) => r1.capacity - r2.capacity;
    const byCapacityDesc = (r1, r2) => r2.capacity - r1.capacity;

    // A non-conflicting slot in the list of possible slots is one that does
    // not lead to a situation where:
    // - Two sessions in the same track are scheduled at the same time.
    // - Two sessions chaired by the same person happen at the same time.
    // - Conflicting sessions are scheduled at the same time.
    // - Session is scheduled in a slot that does not meet the duration
    // requirement.
    // ... Unless these constraints have been relaxed!
    // ... Also note plenary sessions adjust these rules slightly (two
    // sessions in the same plenary in the same track or chaired by the same
    // person are totally fine)
    function nonConflictingDayAndSlot(dayslot) {
      const potentialConflicts = sessions.filter(s =>
        s !== session && s.day === dayslot.day.name && s.slot === dayslot.slot.name);
      // There must be no session in the same track at that time
      const trackConflict = potentialConflicts.find(s =>
        s.tracks.find(track => session.tracks.includes(track)) &&
        (s.description.type !== 'plenary' || session.description.type !== 'plenary'));
      if (trackConflict && meetConflicts.includes('track')) {
        return false;
      }

      // There must be no session chaired by the same chair at that time
      const chairConflict = potentialConflicts.find(s =>
        s.chairs.find(c1 => session.chairs.find(c2 =>
          (c1.login && c1.login === c2.login) ||
          (c1.name && c1.name === c2.name))) &&
        (s.description.type !== 'plenary' || session.description.type !== 'plenary')
      );
      if (chairConflict) {
        return false;
      }

      // There must be no conflicting sessions at the same time.
      if (meetConflicts.includes('session')) {
        const sessionConflict = potentialConflicts.find(s =>
          session.description.conflicts?.includes(s.number) ||
          s.description.conflicts?.includes(session.number));
        if (sessionConflict) {
          return false;
        }
      }

      // Meet duration preference unless we don't care
      if (meetDuration && session.description.duration) {
        if ((strictDuration && dayslot.slot.duration !== session.description.duration) ||
            (!strictDuration && dayslot.slot.duration < session.description.duration)) {
          return false;
        }
      }

      return true;
    }

    // Initialize the list of meetings that we want to schedule.
    // Some may be partially or fully scheduled already.
    let meetings = parseSessionMeetings(session, project);
    if (meetings.length === 0 ||
        (meetings.length === 1 && !session.meeting &&
          !(meetings[0].room && meetings[0].day && meetings[0].slot))) {
      if (strictTimes && session.description.times?.length > 0) {
        // Try to schedule the session during the requested slots
        // and in the right room if the room is imposed
        meetings = session.description.times.map(time => Object.assign({
          room: session.room,
          day: time.day,
          slot: time.slot
        }));
      }
      else {
        // Prepare a list of meetings that we want to schedule
        meetings = [];
        for (let i = 0; i < numberOfMeetings; i++) {
          meetings.push({
            day: session.day,
            room: session.room,
            slot: session.slot
          });
        }
      }
    }

    // Now, the goal is to select as many meetings as needed
    const resourcesToUpdate = [];
    for (const meeting of meetings) {
      // List possible rooms:
      // - If we explicitly set a room already, that's the only possibility.
      // - Otherwise, if the default track room constraint is set, that's
      // the only possible choice.
      // - Otherwise, all rooms that have enough capacity are possible,
      // or all rooms if capacity constraint has been relaxed already.
      const possibleRooms = [];
      if (meeting.room) {
        // Keep room already assigned
        possibleRooms.push(rooms.find(room => room.name === meeting.room));
      }
      else if (trackRoom) {
        // Need to assign the session to the track room
        possibleRooms.push(trackRoom);
      }
      else {
        // All rooms that have enough capacity are candidate rooms
        possibleRooms.push(...rooms
          .filter(room => room.name !== plenaryRoom || session.description.type === 'plenary')
          .filter(room => room.capacity >= (session.description.capacity ?? 0))
          .sort(byCapacity));
        if (!meetCapacity) {
          possibleRooms.push(...rooms
            .filter(room => room.name !== plenaryRoom || session.description.type === 'plenary')
            .filter(room => room.capacity < (session.description.capacity ?? +Infinity))
            .sort(byCapacityDesc));
        }
      }

      if (possibleRooms.length === 0) {
        // Cannot schedule the meeting, stop here
        break;
      }

      for (const room of possibleRooms) {
        // List possible slots in the current room:
        // - If we explicitly set a slot already, that's the only possibility,
        // provided the slot is available in that room!
        // - Otherwise, all the slots that are still available in the room are
        // possible.
        // If we're dealing with a real track, we'll consider possible slots in
        // order. If we're dealing with plenary sessions, we'll fill possible
        // slots in order before moving to the next one. If we're dealing with a
        // session that is not in a track, possible slots are ordered so that
        // less used ones get considered first (to avoid gaps).
        const possibleDayAndSlots = [];
        if (meeting.day && meeting.slot) {
          if (isMeetingAvailableForSession(session, { room, day: session.day, slot: session.slot }) &&
              !meetings.find(m => m !== meeting && m.day === session.day && m.slot === session.slot)) {
            const slot = daysAndSlots.find(ds => ds.day.name === session.day && ds.slot.name === session.slot);
            possibleDayAndSlots.push(slot);
          }
        }
        else {
          possibleDayAndSlots.push(...daysAndSlots
            .filter(ds => !session.day || ds.day.name === session.day)
            .filter(ds => !session.slot || ds.slot.name === session.slot)
            .filter(ds => isMeetingAvailableForSession(session, { room, day: ds.day.name, slot: ds.slot.name }) &&
                          !meetings.find(m => m !== meeting && m.day === ds.day.name && m.slot === ds.slot.name))
          );
          if (session.description.type === 'plenary') {
            // For plenary sessions, fill slot fully before moving to another slot
            possibleDayAndSlots.sort((s1, s2) => {
              const s1len = s1.sessions.filter(s => s.room === plenaryRoom).length;
              const s2len = s2.sessions.filter(s => s.room === plenaryRoom).length;
              if (s1len === s2len) {
                return s2.pos - s1.pos;
              }
              else {
                return s2len - s1len;
              }
            });
          }
          else if (!trackRoom) {
            // When not considering a specific track, fill slots in turn,
            // starting with least busy ones
            possibleDayAndSlots.sort((s1, s2) => {
              const s1len = s1.sessions.length;
              const s2len = s2.sessions.length;
              if (s1len === s2len) {
                return s1.pos - s2.pos;
              }
              else {
                return s1len - s2len;
              }
            });
          }
        }

        // Search for a suitable slot for the current room in the list. If one is
        // found, we're done, otherwise move on to next possible room... or
        // surrender for this set of constraints.
        const dayslot = possibleDayAndSlots.find(nonConflictingDayAndSlot);
        if (dayslot) {
          if (!meeting.room) {
            meeting.room = room.name;
            resourcesToUpdate.push(room);
          }
          if (!meeting.day || !meeting.slot) {
            meeting.day = dayslot.day.name;
            meeting.slot = dayslot.slot.name;
            resourcesToUpdate.push(dayslot);
          }
          break;
        }
      }
    }

    if (meetings.every(m => m.room && m.day && m.slot)) {
      if (resourcesToUpdate.length > 0) {
        if (project.allowMultipleMeetings) {
          session.meeting = serializeSessionMeetings(meetings);
        }
        else {
          session.room = meetings[0].room;
          session.day = meetings[0].day;
          session.slot = meetings[0].slot;
        }
        session.updated = true;
        for (const resource of resourcesToUpdate) {
          resource.sessions.push(session);
        }
      }
      return true;
    }
    else {
      return false;
    }
  }

  // Proceed on a track-by-track basis
  for (const track of tracks) {
    // Choose a default track room that has enough capacity and enough
    // available slots to fit all session tracks, if possible, starting with
    // rooms that have a maximum number of available slots. Relax capacity and
    // slot number constraints if there is no ideal candidate room. In
    // practice, unless we're running short on rooms, this should select a room
    // that is still unused for the track.
    const trackRoom = chooseTrackRoom(track);
    if (track) {
      console.warn(`Schedule sessions in track "${track}" favoring room "${trackRoom.name}"...`);
    }
    else {
      console.warn(`Schedule sessions in main track...`);
    }

    // Process each session in the track in turn, unless it has already been
    // processed (this may happen when the session belongs to two tracks).
    let session = selectNextSession(track);
    while (session) {
      // Attempt to assign a room and slot that meets all constraints.
      // If that fails, relax constraints one by one and start over.
      // Scheduling may fail if there's no way to avoid a conflict and if
      // that conflict cannot be relaxed (e.g., same person cannot chair two
      // sessions at the same time).
      const constraints = {
        trackRoom,
        numberOfMeetings: session.description.times?.length ?? 1,
        strictTimes: true,
        strictDuration: true,
        meetDuration: true,
        meetCapacity: true,
        meetConflicts: ['session', 'track']
      };
      while (!chooseSessionMeetings(session, constraints)) {
        if (constraints.strictDuration && session.description.duration) {
          console.warn(`- relax duration comparison for #${session.number}`);
          constraints.strictDuration = false;
        }
        else if (constraints.trackRoom) {
          console.warn(`- relax track constraint for #${session.number}`);
          constraints.trackRoom = null;
        }
        else if (constraints.strictTimes && (session.description.times?.length > 0)) {
          console.warn(`- relax times constraint for #${session.number}`);
          constraints.strictTimes = false;
        }
        else if (constraints.numberOfMeetings > 1) {
          console.warn(`- decrement number of meetings for #${session.number}`);
          constraints.numberOfMeetings -= 1;
        }
        else if (constraints.meetDuration && session.description.duration) {
          console.warn(`- forget duration constraint for #${session.number}`);
          constraints.meetDuration = false;
        }
        else if (constraints.meetCapacity) {
          console.warn(`- forget capacity constraint for #${session.number}`);
          constraints.meetCapacity = false;
        }
        else if (constraints.meetConflicts.length === 2) {
          console.warn(`- forget session conflicts for #${session.number}`);
          constraints.meetConflicts = ['track'];
        }
        else if (constraints.meetConflicts[0] === 'track') {
          console.warn(`- forget track conflicts for #${session.number}`);
          constraints.meetConflicts = ['session'];
        }
        else if (constraints.meetConflicts.length > 0) {
          console.warn(`- forget all conflicts for #${session.number}`);
          constraints.meetConflicts = [];
        }
        else {
          console.warn(`- could not find a suitable meeting for #${session.number}`);
          break;
        }
      }
      for (const meeting of session.meetings) {
        console.warn(`- assigned #${session.number} to ${session.day} ${session.slot} in ${session.room}`);
      }
      session = selectNextSession(track);
    }
    if (track) {
      console.warn(`Schedule sessions in track "${track}" favoring room "${trackRoom.name}"... done`);
    }
    else {
      console.warn(`Schedule sessions in main track... done`);
    }
  }
}