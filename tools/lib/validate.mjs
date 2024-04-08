import { fetchProject, validateProject } from './project.mjs';
import { initSectionHandlers, validateSessionBody, parseSessionBody } from './session.mjs';
import { fetchSessionChairs, validateSessionChairs } from './chairs.mjs';
import { fetchSessionGroups, validateSessionGroups } from './groups.mjs';
import { todoStrings } from './todostrings.mjs';


/**
 * Validate the entire grid.
 * 
 * The function returns a list of errors by type. Each error links to the
 * session that may need some care.
 */
export async function validateGrid(project) {
  const projectErrors = validateProject(project);
  if (projectErrors.length > 0) {
    throw new Error(`Project "${project.title}" is invalid:
${projectErrors.map(error => '- ' + error).join('\n')}`);
  }

  let errors = [];
  for (const session of project.sessions) {
    const sessionErrors = await validateSession(session.number, project);
    errors = errors.concat(sessionErrors);
  }
  return errors;
}


/**
 * Validate a session.
 *
 * The function returns a list of errors by type (i.e., by GitHub "label").
 * Errors in the list may be real errors or warnings.
 */
export async function validateSession(sessionNumber, project) {
  const projectErrors = validateProject(project);
  if (projectErrors.length > 0) {
    throw new Error(`Project "${project.title}" is invalid:
${projectErrors.map(error => '- ' + error).join('\n')}`);
  }

  // Retrieve name of plenary room and maximum number of sessions per plenary
  const plenaryRoom = (project.metadata['plenary room'] ?? 'plenary').toLowerCase();
  let plenaryHolds;
  if (project.metadata['plenary holds']?.match(/^\d+$/)) {
    plenaryHolds = parseInt(project.metadata['plenary holds'], 10);
  }
  else {
    plenaryHolds = 5;
  }

  // Look for session in the list of issues in the project
  const session = project.sessions.find(s => s.number === sessionNumber);
  if (!session) {
    throw new Error(`Session #${sessionNumber} is not in project "${project.title}"`);
  }

  // List of validation issues found, grouped by type (i.e. by label).
  let errors = [];

  // Validate and parse the session body, unless that was already done
  if (!session.description) {
    await initSectionHandlers();
    const formatErrors = validateSessionBody(session.body);
    if (formatErrors.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'error',
        type: 'format',
        messages: formatErrors
      });
      // Cannot validate the rest for now if body cannot be parsed
      return errors;
    }
    session.description = parseSessionBody(session.body);
  }

  if (project.metadata.type === 'groups') {
    // Retrieve information about groups for all sessions
    for (const s of project.sessions) {
      s.groups = await fetchSessionGroups(s, project.groupsToW3CID);
    }
    const groupsErrors = validateSessionGroups(session.groups);
    if (groupsErrors.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'error',
        type: 'groups',
        messages: groupsErrors
      });
    }
    else if (session.title.match(/ Joint Meeting$/i)) {
      // TODO: validate that groups appear no more than once in the list
      if (session.groups.length === 1) {
        errors.push({
          session: sessionNumber,
          severity: 'error',
          type: 'groups',
          messages: ['Group cannot have a joint meeting with itself']
        });
      }
    }
    else if (session.groups.length === 1) {
      const duplSessions = project.sessions.filter(s =>
        s !== session &&
        s.groups.length === 1 &&
        s.groups[0].type === session.groups[0].type &&
        s.groups[0].abbrName === session.groups[0].abbrName);
      if (duplSessions.length > 0) {
        errors.push({
          session: sessionNumber,
          severity: 'error',
          type: 'groups',
          messages: duplSessions.map(dupl => `Another issue #${dupl.number} found for the "${session.groups[0].label}"`)
        });
      }
    }
  }
  else {
    // Retrieve information about chairs, unless that was already done
    if (!session.chairs) {
      session.chairs = await fetchSessionChairs(session, project.chairsToW3CID);
    }
    const chairsErrors = validateSessionChairs(session.chairs);
    if (chairsErrors.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'error',
        type: 'chairs',
        messages: chairsErrors
      });
    }
  }

  // Make sure sessions identified as conflicting actually exist
  let hasConflictErrors = false;
  if (session.description.conflicts) {
    let conflictErrors = null;
    if (session.description.type === 'plenary') {
      // Plenary sessions cannot conflict with anything
      // (Note: this will need to be adjusted if two or more "plenary" rooms
      // get used at once)
      conflictErrors = ['Plenary session cannot conflict with any other session'];
    }
    else {
      conflictErrors = session.description.conflicts
        .map(number => {
          if (number === sessionNumber) {
            return `Session cannot conflict with itself`;
          }
          const conflictingSession = project.sessions.find(s => s.number === number);
          if (!conflictingSession) {
            return `Conflicting session #${number} is not in the project`;
          }
          return null;
        })
        .filter(error => !!error);
    }
    hasConflictErrors = conflictErrors.length > 0;
    if (hasConflictErrors) {
      errors.push({
        session: sessionNumber,
        severity: 'error',
        type: 'conflict',
        messages: conflictErrors
      });
    }
  }

  // Make sure that a plenary session is scheduled in a plenary room, and that
  // a breakout session is scheduled in a breakout room.
  // (Note: this will need to be relaxed if two or more "plenary" rooms get
  // used at once, and/or if the plenary room can be reused for breakouts.
  if (session.room) {
    if (session.description.type === 'plenary') {
      if (session.room.toLowerCase() !== plenaryRoom) {
        errors.push({
          session: sessionNumber,
          severity: 'error',
          type: 'scheduling',
          messages: ['Plenary session must be scheduled in plenary room']
        });
      }
    }
    else {
      if (session.room.toLowerCase() === plenaryRoom) {
        errors.push({
          session: sessionNumber,
          severity: 'error',
          type: 'scheduling',
          messages: ['Breakout session must not be scheduled in plenary room']
        });
      }
    }
  }

  // Make sure there is no session scheduled at the same time in the same room,
  // skipping plenary sessions since they are, by definition, scheduled at the
  // same time and in the same room.
  const scheduled = session.room && session.day && session.slot;
  if (scheduled && (session.description.type !== 'plenary')) {
    const schedulingErrors = project.sessions
      .filter(s => s !== session && s.room && s.day && s.slot)
      .filter(s => s.room === session.room && s.day === session.day && s.slot === session.slot)
      .map(s => `Session scheduled in same room (${s.room}) and same day/slot (${s.day} ${s.slot}) as session "${s.title}" (${s.number})`);
    if (schedulingErrors.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'error',
        type: 'scheduling',
        messages: schedulingErrors
      });
    }
  }

  // Make sure that the number of sessions in a plenary does not exceed the
  // maximum allowed.
  if (scheduled && (session.description.type === 'plenary')) {
    const plenarySessions = project.sessions
      .filter(s => s.room && s.day && s.slot)
      .filter(s => s.room === session.room && s.day === session.day && s.slot === session.slot);
    if (plenarySessions.length > plenaryHolds) {
      errors.push({
        session: sessionNumber,
        severity: 'error',
        type: 'scheduling',
        messages: ['Too many sessions scheduled in same plenary slot']
      });
    }
  }

  // Check assigned room matches requested capacity
  if (session.room && session.description.capacity) {
    const room = project.rooms.find(s => s.name === session.room);
    if (room.capacity < session.description.capacity) {
      errors.push({
        session: sessionNumber,
        severity: 'warning',
        type: 'capacity',
        messages: ['Room capacity is lower than requested capacity']
      });
    }
  }

  // Check absence of conflict with sessions with same group(s) or chair(s)
  // Note: It's fine to have two plenary sessions with same chair(s) scheduled
  // in the same room and at the same time.
  if (session.day && session.slot) {
    const chairOrGroup = (project.metadata.type === 'groups') ?
      'group' : 'chair';

    const chairConflictErrors = project.sessions
      .filter(s => s !== session && s.day === session.day && s.slot === session.slot && s.room !== session.room)
      .filter(s => {
        try {
          if (project.metadata.type === 'groups') {
            const inboth = s.groups.find(group => session.groups.find(g =>
              g.type === group.type && g.abbrName === group.abbrName));
            return !!inboth;
          }
          else {
            const sdesc = parseSessionBody(s.body);
            const sAuthorExcluded = sdesc.chairs?.find(c => c.name?.toLowerCase() === 'author-');
            if (!sAuthorExcluded && session.chairs.find(c => c.login === s.author.login)) {
              return true;
            }
            const inboth = sdesc.chairs.find(chair => session.chairs.find(c =>
              (c.login && c.login.toLowerCase() === chair.login?.toLowerCase()) ||
              (c.name && c.name.toLowerCase() === chair.name?.toLowerCase())));
            return !!inboth;
          }
        }
        catch {
          return false;
        }
      })
      .map(s => `Same slot as session "${s.title}" (#${s.number}), which shares a common ${chairOrGroup}`);
    if (chairConflictErrors.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'error',
        type: `${chairOrGroup} conflict`,
        messages: chairConflictErrors
      });
    }
  }

  // Check assigned slot is different from conflicting sessions
  // (skipped if the list of conflicting sessions is invalid)
  if (!hasConflictErrors && session.day && session.slot && session.description.conflicts) {
    const conflictWarnings = session.description.conflicts
      .map(number => {
        const conflictingSession = project.sessions.find(s => s.number === number);
        if (conflictingSession.day === session.day && conflictingSession.slot === session.slot) {
          return `Same day/slot "${session.day} ${session.slot}" as conflicting session "${conflictingSession.title}" (#${conflictingSession.number})`;
        }
        return null;
      })
      .filter(warning => !!warning);
    if (conflictWarnings.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'warning',
        type: 'conflict',
        messages: conflictWarnings
      });
    }
  }

  // Check absence of conflict with sessions in the same track(s)
  // Note: It's fine to have two plenary sessions in the same track(s)
  // scheduled in the same room and at the same time.
  if (session.day && session.slot) {
    const tracks = session.labels.filter(label => label.startsWith('track: '));
    let tracksWarnings = [];
    for (const track of tracks) {
      const sessionsInSameTrack = project.sessions.filter(s => s !== session && s.labels.includes(track));
      const trackWarnings = sessionsInSameTrack
        .map(other => {
          if (other.day === session.day && other.slot === session.slot && other.room !== session.room) {
            return `Same day/slot "${session.day} ${session.slot}" as session in same track "${track}": "${other.title}" (#${other.number})`;
          }
          return null;
        })
        .filter(warning => !!warning);
      tracksWarnings = tracksWarnings.concat(trackWarnings);
    }
    if (tracksWarnings.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'warning',
        type: 'track',
        messages: tracksWarnings
      });
    }
  }

  // Check that there is no plenary session scheduled at the same time as this
  // session
  if (session.day && session.slot) {
    const plenaryWarnings = project.sessions
      .filter(s => s !== session && s.day && s.slot && s.room)
      .filter(s => s.day === session.day && s.slot === session.slot && s.room !== session.room)
      .filter(s => {
        try {
          const desc = parseSessionBody(s.body);
          return desc.type === 'plenary';
        }
        catch {
          return false;
        }
      })
      .map(other => {
        return `Same time/slot "${session.day} ${session.slot}" as plenary session "${other.title}" (#${other.number})`;
      });
    if (plenaryWarnings.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'warning',
        type: 'plenary',
        messages: plenaryWarnings
      });
    }
  }

  // No two sessions can use the same IRC channel during the same slot,
  // unless both sessions are part of the same plenary meeting.
  if (session.description.shortname) {
    const ircConflicts = project.sessions
      .filter(s => s.number !== session.number && s.day === session.day && s.slot === session.slot)
      .filter(s => {
        try {
          const desc = parseSessionBody(s.body);
          return desc.shortname === session.description.shortname &&
            (desc.type !== 'plenary' || session.description.type !== 'plenary');
        }
        catch {
          return false;
        }
      });
    if (ircConflicts.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'error',
        type: 'irc',
        messages: ircConflicts.map(s => `Same IRC channel "${session.description.shortname}" as session #${s.number} "${s.title}"`)
      });
    }
  }

  // Check presence of comments
  if (session.description.comments) {
    errors.push({
      session: sessionNumber,
      severity: 'check',
      type: 'instructions',
      messages: ['Session contains instructions for meeting planners']
    });
  }

  function isMaterialMissing(name) {
    return !session.description.materials ||
      !session.description.materials[name] ||
      todoStrings.includes(session.description.materials[name].toUpperCase());
  }

  // If breakout session took place more than 2 days ago,
  // time to add a link to the minutes
  if (scheduled && isMaterialMissing('minutes')) {
    const day = project.days.find(d => d.name === session.day);
    const twoDaysInMs = 48 * 60 * 60 * 1000;
    const atLeastTwoDaysOld = (
        (new Date()).getTime() -
        (new Date(day.date)).getTime()
      ) > twoDaysInMs;
    if (atLeastTwoDaysOld) {
      errors.push({
        session: sessionNumber,
        severity: 'warning',
        type: 'minutes',
        messages: ['Session needs a link to the minutes']
      });
    }
  }

  // Minutes should ideally be stored on www.w3.org
  if (!isMaterialMissing('minutes')) {
    const minutesUrl = session.description.materials.minutes;
    if (!minutesUrl.match(/\/(www|lists)\.w3\.org\//)) {
      errors.push({
        session: sessionNumber,
        severity: 'warning',
        type: 'minutes origin',
        messages: ['Minutes not stored on w3.org']
      });
    }
  }

  return errors;
}