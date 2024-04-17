#!/usr/bin/env node
/**
 * This tool suggests a grid that could perhaps work given known constraints.
 *
 * To run the tool:
 *
 *  npx suggest-grid [preservelist or all or none] [exceptlist or none] [apply] [seed]
 *
 * where [preservelist or all] is a comma-separated (no spaces) list of session
 * numbers whose assigned slots and rooms must be preserved. Or "all" to
 * preserve all slots and rooms that have already been assigned. Or "none" not
 * to preserve anything.
 * 
 * [exceptlist or none] only makes sense when the preserve list is "all" and
 * allows to specify a comma-separated (no spaces) list of session numbers whose
 * assigned slots and rooms are to be discarded. Or "none" to say "no exception,
 * preserve info in all sessions".
 * 
 * [apply] is "apply" if you want to apply the suggested grid on GitHub, or
 * a link to a changes file if you want to test changes to the suggested grid
 * before it gets validated and saved as an HTML page. The changes file must be
 * a file where each row starts with a session number, followed by a space,
 * followed by either a slot start time or a slot number or a room name. If slot
 * was specified, it may be followed by another space, followed by a room name.
 * (Room name cannot be specified before the slot).
 *
 * [seed] is the seed string to shuffle the array of sessions. How much
 * shuffling happens depends on other parameters which take
 * precedence (e.g., the preserve list).
 * 
 * Examples:
 *
 * To generate a grid leveraging constraints identified by the
 * session chairs (e.g., avoid conflicts with identified sessions):
 *   npx suggest-grid
 *
 * To generate a grid leveraging constraints identified by the
 * session chairs and also any hard-coded rooms or time slots in
 * the project:
 *   npx suggest-grid all
 *
 * To generate a grid leveraging constraints identified by the
 * session chairs and also any hard-coded rooms or time slots in
 * the project, except specifically ignoring what has been
 * hard-coded for sessions 6 and 14 (while leaving the Project intact):
 *   npx suggest-grid all 6,14
 * 
 * To generate a grid leveraging constraints identified by the
 * session chairs and also any hard-coded rooms or time slots in
 * the project, except [without modifying the project] trying out
 * a schedule achieved by swapping session times for sessions 7 and 9:
 *
 * 1) Create a file (e.g., changes.txt) that includes, for example:
 *    7 13:00
 *    9 14:00
 * 
 * 2) Run npx suggest-grid all none changes.txt
 * 
 *
 * To generate a grid that has been previously generated (ignoring
 * any hard-coded project information) with seed "dfwla":
 *
 * npx suggest-grid none none false dfwla
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

import { readFile } from 'fs/promises';
import { getEnvKey } from './lib/envkeys.mjs';
import { fetchProject, assignSessionsToSlotAndRoom } from './lib/project.mjs';
import { validateSession } from './lib/validate.mjs';
import { validateGrid } from './lib/validate.mjs';
import { convertProjectToHTML } from './lib/project2html.mjs';
import { parseMeetingsChanges,
         applyMeetingsChanges } from '../tools/lib/meetings.mjs';
import seedrandom from 'seedrandom';

const schedulingErrors = [
  'error: chair conflict',
  'error: group conflict',
  'error: scheduling',
  'error: irc',
  'error: meeting duplicate',
  'warning: capacity',
  'warning: conflict',
  'warning: duration',
  'warning: track'
];

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
 * Helper function to generate a random seed
 */
function makeseed() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  return [1, 2, 3, 4, 5]
    .map(_ => chars.charAt(Math.floor(Math.random() * chars.length)))
    .join('');
}

async function main({ preserve, except, changesFile, apply, seed }) {
  seed = seed ?? makeseed();
  const PROJECT_OWNER = await getEnvKey('PROJECT_OWNER');
  const PROJECT_NUMBER = await getEnvKey('PROJECT_NUMBER');
  const CHAIR_W3CID = await getEnvKey('CHAIR_W3CID', {}, true);
  console.warn();
  console.warn(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER}...`);
  const project = await fetchProject(PROJECT_OWNER, PROJECT_NUMBER);
  if (!project) {
    throw new Error(`Project ${PROJECT_OWNER}/${PROJECT_NUMBER} could not be retrieved`);
  }
  project.chairsToW3CID = CHAIR_W3CID;
  console.warn(`- found ${project.sessions.length} sessions`);
  let sessions = await Promise.all(project.sessions.map(async session => {
    const sessionErrors = (await validateSession(session.number, project))
      .filter(err =>
        err.severity === 'error' &&
        err.type !== 'chair conflict' &&
        err.type !== 'group conflict' &&
        err.type !== 'meeting duplicate' &&
        err.type !== 'scheduling' &&
        err.type !== 'irc');
    if (sessionErrors.length > 0) {
      return null;
    }
    return session;
  }));
  sessions = sessions.filter(s => !!s);
  sessions.sort((s1, s2) => s1.number - s2.number);
  console.warn(`- found ${sessions.length} valid sessions among them: ${sessions.map(s => s.number).join(', ')}`);
  shuffle(sessions, seed);
  console.warn(`- shuffled sessions with seed "${seed}" to: ${sessions.map(s => s.number).join(', ')}`);
  console.warn(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER} and session(s)... done`);

  // Consider that default capacity is "average number of people" to avoid assigning
  // sessions to too small rooms
  for (const session of sessions) {
    if (session.description.capacity === 0) {
      session.description.capacity = 24;
    }
  }

  const rooms = project.rooms;
  const slots = project.slots;
  const days = project.days;
  const plenaryRoom = project.metadata['plenary room'] ?? 'Plenary';
  let plenaryHolds;
  if (project.metadata['plenary holds']?.match(/^\d+$/)) {
    plenaryHolds = parseInt(project.metadata['plenary holds'], 10);
  }
  else {
    plenaryHolds = 5;
  }

  // Load changes to apply locally if so requested
  let changes = [];
  if (changesFile) {
    console.warn('Load changes file...');
    const yaml = await readFile(changesFile, 'utf8');
    changes = parseMeetingsChanges(yaml);
    console.warn(`- ${changes.length} changes detected`);
    console.warn('Load changes file... done');
  }

  // Save initial grid algorithm settings as CLI params
  const cli = {};
  if (preserve === 'all') {
    cli.preserve = 'all';
  }
  else if (!preserve || preserve.length === 0) {
    cli.preserve = 'none';
  }
  else {
    cli.preserve = preserve.join(',');
  }
  if (!except) {
    cli.except = 'none';
  }
  else if (except.length > 0) {
    cli.except = except.join(',');
  }
  else {
    cli.except = 'none';
  }
  cli.seed = seed;
  cli.apply = apply;
  cli.cmd = `npx suggest-grid ${cli.preserve} ${cli.except} ${apply} ${cli.seed}`;

  if (preserve === 'all') {
    preserve = sessions.filter(s => s.day || s.slot || s.room).map(s => s.number);
  }
  if (except) {
    preserve = preserve.filter(nb => !except.includes(nb));
  }
  if (!preserve) {
    preserve = [];
  }
  for (const session of sessions) {
    if (!preserve.includes(session.number)) {
      session.day = undefined;
      session.slot = undefined;
      session.room = undefined;
    }
  }

  // Initialize the list of tracks
  // Note: for the purpose of scheduling, a "_plenary" track gets artificially
  // created so that plenary sessions get scheduled first. That's needed to
  // avoid scheduling breakout sessions in parallel to plenary sessions.
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

  // Initalize the list of days and slots and the occupation views
  const daysAndSlots = [];
  let pos = 0;
  for (const day of days) {
    for (const slot of slots) {
      daysAndSlots.push({
        day, slot,
        pos,
        sessions: sessions.filter(s => s.day === day.name && s.slot === slot.name)
      });
      pos += 1;
    }
  }
  for (const room of rooms) {
    room.pos = rooms.indexOf(room);
    room.sessions = sessions.filter(s => s.room === room.name);
  }

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

  function isRoomAndSlotAvailableForSession(session, room, dayName, slotName) {
    if (session.description.type === 'plenary') {
      const breakoutSlot = room.sessions.find(s => s !== session &&
        s.day === dayName && s.slot === slotName && s.description.type !== 'plenary');
      const alreadyScheduled =
        room.sessions.filter(s => s !== session && s.day === dayName && s.slot === slotName);
      return (!breakoutSlot && alreadyScheduled.length < plenaryHolds);
    }
    else {
      return !room.sessions.find(s => s !== session && s.day === dayName && s.slot === slotName) &&
        !sessions.find(s => s !== session && s.day === dayName && s.slot === slotName &&
          s.description.type === 'plenary');
    }
  }

  function setRoomAndSlot(session, {
    trackRoom, strictDuration, meetDuration, meetCapacity, meetConflicts
  }) {
    const byCapacity = (r1, r2) => r1.capacity - r2.capacity;
    const byCapacityDesc = (r1, r2) => r2.capacity - r1.capacity;

    // List possible rooms:
    // - If we explicitly set a room already, that's the only possibility.
    // - Otherwise, if the default track room constraint is set, that's
    // the only possible choice.
    // - Otherwise, all rooms that have enough capacity are possible,
    // or all rooms if capacity constraint has been relaxed already.
    const possibleRooms = [];
    if (session.room) {
      // Keep room already assigned
      possibleRooms.push(rooms.find(room => room.name === session.room));
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
      return false;
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
      if (session.day && session.slot) {
        if (isRoomAndSlotAvailableForSession(session, room, session.day, session.slot)) {
          const slot = daysAndSlots.find(ds => ds.day.name === session.day && ds.slot.name === session.slot);
          possibleDayAndSlots.push(slot);
        }
      }
      else {
        possibleDayAndSlots.push(...daysAndSlots
          .filter(ds => !session.day || ds.day.name === session.day)
          .filter(ds => !session.slot || ds.slot.name === session.slot)
          .filter(ds => isRoomAndSlotAvailableForSession(session, room, ds.day.name, ds.slot.name)));
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

      // Search for a suitable slot for the current room in the list. If one is
      // found, we're done, otherwise move on to next possible room... or
      // surrender for this set of constraints.
      const dayslot = possibleDayAndSlots.find(nonConflictingDayAndSlot);
      if (dayslot) {
        if (!session.room) {
          session.room = room.name;
          session.updated = true;
          room.sessions.push(session);
        }
        if (!session.day || !session.slot) {
          session.day = dayslot.day.name;
          session.slot = dayslot.slot.name;
          session.updated = true;
          dayslot.sessions.push(session);
        }
        return true;
      }
    }

    return false;
  }

  // Proceed on a track-by-track basis, and look at sessions in each track in
  // turn.
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
        strictDuration: true,
        meetDuration: true,
        meetCapacity: true,
        meetConflicts: ['session', 'track']
      };
      while (!setRoomAndSlot(session, constraints)) {
        if (constraints.strictDuration && session.description.duration) {
          console.warn(`- relax duration comparison for #${session.number}`);
          constraints.strictDuration = false;
        }
        else if (constraints.trackRoom) {
          console.warn(`- relax track constraint for #${session.number}`);
          constraints.trackRoom = null;
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
          console.warn(`- could not find a room and slot for #${session.number}`);
          break;
        }
      }
      if (session.room && session.day && session.slot) {
        console.warn(`- assigned #${session.number} to room ${session.room} and day/slot ${session.day} ${session.slot}`);
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

  sessions.sort((s1, s2) => s1.number - s2.number);

  for (const session of sessions) {
    if (!session.day || !session.slot || !session.room) {
      const tracks = session.tracks.length ? ' - ' + session.tracks.join(', ') : '';
      console.warn(`- [WARNING] #${session.number} could not be scheduled${tracks}`);
    }
  }

  if (changes.length > 0) {
    console.warn();
    console.warn(`Apply local changes...`);
    applyMeetingsChanges(sessions, changes);
    console.warn(`Apply local changes... done`);
  }

  console.warn();
  console.warn(`Validate grid...`);
  const errors = (await validateGrid(project))
    .filter(error => schedulingErrors.includes(`${error.severity}: ${error.type}`));
  if (errors.length) {
    for (const error of errors) {
      console.warn(`- [${error.severity}: ${error.type}] #${error.session}: ${error.messages.join(', ')}`);
    }
  }
  else {
    console.warn(`- looks good!`);
  }
  console.warn(`Validate grid... done`);

  cli.preserveInPractice = (preserve !== 'all' && preserve.length > 0) ?
    ' (in practice: ' + preserve.sort((n1, n2) => n1 - n2).join(',') + ')' :
    '';
  const html = await convertProjectToHTML(project, cli);
  console.warn();
  console.log(html);

  console.warn();
  console.warn('To re-generate the grid, run:');
  console.warn(cli.cmd);

  if (apply) {
    console.warn();
    const sessionsToUpdate = sessions.filter(s => s.updated);
    for (const session of sessionsToUpdate) {
      console.warn(`- updating #${session.number}...`);
      await assignSessionsToSlotAndRoom(session, project);
      console.warn(`- updating #${session.number}... done`);
    }
  }
}


// Read preserve list from command-line
let preserve;
if (process.argv[2]) {
  if (!process.argv[2].match(/^all|none|\d+(,\d+)*$/)) {
    console.warn('Command needs to receive a list of issue numbers as first parameter or "all"');
    process.exit(1);
  }
  if (process.argv[2] === 'all') {
    preserve = 'all';
  }
  else if (process.argv[2] === 'none') {
    preserve = [];
  }
  else {
    preserve = process.argv[2].split(',').map(n => parseInt(n, 10));
  }
}

// Read except list
let except;
if (process.argv[3]) {
  if (!process.argv[3].match(/^none|\d+(,\d+)*$/)) {
    console.warn('Command needs to receive a list of issue numbers as second parameter or "none"');
    process.exit(1);
  }
  except = process.argv[3] === 'none' ?
    undefined :
    process.argv[3].split(',').map(n => parseInt(n, 10));
}

const apply = process.argv[4] === 'apply';
const changesFile = (apply || !process.argv[4] || !process.argv[4].match(/\./)) ?
  undefined :
  process.argv[4];
const seed = process.argv[5] ?? undefined;

main({ preserve, except, changesFile, apply, seed })
  .catch(err => {
    console.warn(`Something went wrong: ${err.message}`);
    throw err;
  });
