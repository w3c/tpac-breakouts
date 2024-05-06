import { validateProject } from './project.mjs';
import { initSectionHandlers, validateSessionBody, parseSessionBody } from './session.mjs';
import { fetchSessionChairs, validateSessionChairs } from './chairs.mjs';
import { fetchSessionGroups, validateSessionGroups } from './groups.mjs';
import { parseSessionMeetings, meetsAt, meetsInParallelWith } from './meetings.mjs';
import { todoStrings } from './todostrings.mjs';

// List of errors and warnings that are scheduling issues.
const schedulingErrors = [
  'error: chair conflict',
  'error: scheduling',
  'error: irc',
  'warning: capacity',
  'warning: conflict',
  'warning: duration',
  'warning: track'
];

/**
 * Validate the entire grid.
 * 
 * The function returns two things:
 * 1. a list of errors by type. Each error links to the session that may need
 * some care.
 * 2. a list of sessions for which validation changes, along with the new
 * validation results, taking session notes into account (which may remove
 * warnings). Note the function does not update the session itself
 */
export async function validateGrid(project,
    { what = 'everything' } = { what: 'everything' }) {
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
  errors = errors.filter(error =>
    what === 'everything' ||
    schedulingErrors.includes(`${error.severity}: ${error.type}`));

  const changes = project.sessions
    .map(session => {
      const changes = {
        number: session.number,
        validation: {}
      };
      let hasChanged = false;
      for (const severity of ['error', 'warning', 'check']) {
        let results = errors
          .filter(error => error.session === session.number && error.severity === severity)
          .map(error => error.type);
        if (severity === 'check' &&
            session.validation.check?.includes('irc channel') &&
            !results.includes('irc channel')) {
          // Need to keep the 'irc channel' value until an admin removes it
          results.push('irc channel');
        }
        else if (severity === 'warning' && session.validation.note) {
          results = results.filter(warning =>
            !session.validation.note.includes(`-warning:${warning}`) &&
            !session.validation.note.includes(`-warn:${warning}`) &&
            !session.validation.note.includes(`-w:${warning}`));
        }
        if (what !== 'everything' && session.validation[severity]) {
          // Need to preserve previous results that touched on other aspects
          const previousResults = session.validation[severity]
            .split(',')
            .map(value => value.trim());
          for (const result of previousResults) {
            if (!schedulingErrors.includes(`${severity}: ${result}`)) {
              results.push(result);
            }
          }
        }
        results = results.sort();
        changes.validation[severity] = results.join(', ');
        if ((session.validation[severity] ?? '') !== changes.validation[severity]) {
          hasChanged = true;
        }
      }
      return hasChanged ? changes : null;
    })
    .filter(session => !!session);

  return { errors, changes };
}


/**
 * Validate a session.
 *
 * The function returns a list of errors by type (i.e., by GitHub "label").
 * Errors in the list may be real errors or warnings.
 */
export async function validateSession(sessionNumber, project, changes) {
  function hasActualMeeting(meetings) {
    return meetings.length > 0 &&
      meetings[0].room &&
      meetings[0].day &&
      meetings[0].slot;
  }

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
    await initSectionHandlers(project);
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
      s.groups = await fetchSessionGroups(s, project.chairsToW3CID);
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

  // Look at scheduling conflicts.
  // Note we start with building the list of meeting tuples (room, day, slot)
  // that the session is associated with. Breakout sessions should be
  // scheduled only once. Group meetings may be scheduled multiple times.
  const meetings = parseSessionMeetings(session, project);
  const meetingsErrors = meetings.filter(meeting => meeting.invalid);
  if (meetingsErrors.length > 0) {
    errors.push({
      session: sessionNumber,
      severity: 'error',
      type: 'meeting format',
      messages: meetingsErrors.map(m => `Invalid room, day or slot in "${m.invalid}"`)
    });
  }

  const duplMeetingsErrors = meetings.filter(meeting => meetings.find(m =>
    m !== meeting &&
    m.day && m.slot &&
    m.day === meeting.day &&
    m.slot === meeting.slot
  ));
  if (duplMeetingsErrors.length > 0) {
    errors.push({
      session: sessionNumber,
      severity: 'error',
      type: 'meeting duplicate',
      messages: [...new Set(duplMeetingsErrors.map(m => `Scheduled more than once in day/slot ${m.day} ${m.slot}`))],
      details: duplMeetingsErrors
    });
  }

  if (session.description.type === 'plenary') {
    // Plenary must be scheduled in only one slot and in the plenary room
    // (Note: this will need to be relaxed if two or more "plenary" rooms get
    // used at once)
    if (meetings.length > 1) {
      errors.push({
        session: sessionNumber,
        severity: 'error',
        type: 'scheduling',
        messages: ['Plenary session must be scheduled only once'],
        details: meetings
      });
    }
    else if (meetings.length === 1) {
      if (meetings[0].room && meetings[0].room.toLowerCase() !== plenaryRoom) {
        errors.push({
          session: sessionNumber,
          severity: 'error',
          type: 'scheduling',
          messages: ['Plenary session must be scheduled in plenary room'],
          details: meetings
        });
      }

      // Make sure that the number of sessions in a plenary does not exceed the
      // maximum allowed.
      if (hasActualMeeting(meetings)) {
        const plenarySessions = project.sessions
          .filter(s => meetsAt(s, meetings[0], project));
        if (plenarySessions.length > plenaryHolds) {
          errors.push({
            session: sessionNumber,
            severity: 'error',
            type: 'scheduling',
            messages: ['Too many sessions scheduled in same plenary slot'],
            details: meetings.slice(0, 1)
          });
        }
      }
    }
  }
  else {
    // Non plenary sessions must be scheduled in a breakout room
    // (Note: this will need to be relaxed if the plenary room can be reused
    // for other types of meetings)
    const plenaryMeeting = meetings.find(meeting =>
      meeting.room?.toLowerCase() === plenaryRoom);
    if (plenaryMeeting) {
      errors.push({
        session: sessionNumber,
        severity: 'error',
        type: 'scheduling',
        messages: ['Non plenary session must not be scheduled in plenary room'],
        details: [plenaryMeeting]
      });
    }

    // Make sure there is no session scheduled at the same time in the same room,
    // skipping plenary sessions since they are, by definition, scheduled at the
    // same time and in the same room.
    const schedulingErrors = meetings
      .filter(meeting => meeting.room && meeting.day && meeting.slot)
      .map(meeting => project.sessions
        .filter(s => s !== session && meetsAt(s, meeting, project))
        .map(s => Object.assign({ meeting, session, conflictsWith: s }))
      )
      .flat()
      .filter(error => !!error);
    if (schedulingErrors.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'error',
        type: 'scheduling',
        messages: schedulingErrors.map(err => `Session scheduled in same room (${err.meeting.room}) and same day/slot (${err.meeting.day} ${err.meeting.slot}) as session "${err.conflictsWith.title}" (${err.conflictsWith.number})`),
        details: schedulingErrors
      });
    }
  }

  // Warn when chosen meetings don't match requested times
  if (session.description.times?.length > 0 && meetings.length > 0) {
    const schedulingWarnings = session.description.times
      .filter(time => !meetings.find(m => m.day === time.day && m.slot === time.slot))
      .map(time => Object.assign({ meeting: time, session }));
    if (schedulingWarnings.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'warning',
        type: 'times',
        messages: schedulingWarnings.map(w => `Session not scheduled on ${w.meeting.day} at ${w.meeting.slot} as requested`),
        details: schedulingWarnings
      });
    }
    if (session.description.times.length !== meetings.length) {
      errors.push({
        session: sessionNumber,
        severity: 'warning',
        type: 'times',
        messages: [`Session scheduled ${meetings.length} times instead of ${session.description.times.length}`]
      });
    }
  }

  // Check assigned room matches requested capacity
  if (session.description.capacity) {
    const capacityWarnings = meetings
      .filter(meeting => meeting.room)
      .map(meeting => {
        const room = project.rooms.find(s => s.name === meeting.room);
        if (room.capacity < session.description.capacity) {
          return { meeting, session, room };
        }
        return null;
      })
      .filter(warning => !!warning);
    if (capacityWarnings.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'warning',
        type: 'capacity',
        messages: capacityWarnings.map(warn => `Capacity of "${warn.room.label}" (${warn.room.capacity}) is lower than requested capacity (${session.description.capacity})`),
        details: capacityWarnings
      });
    }
  }

  // Check absence of conflict with sessions with same group(s) or chair(s)
  // Note: It's fine to have two plenary sessions with same chair(s) scheduled
  // in the same room and at the same time.
  const chairOrGroup = (project.metadata.type === 'groups') ?
    'group' : 'chair';
  const chairConflictErrors = meetings
    .filter(meeting => meeting.day && meeting.slot)
    .map(meeting => project.sessions
      .filter(s => s !== session && meetsInParallelWith(s, meeting, project))
      .map(s => {
        let inboth = [];
        try {
          if (project.metadata.type === 'groups') {
            inboth = inboth.concat(s.groups
              .filter(group => session.groups.find(g =>
                g.type === group.type && g.abbrName === group.abbrName))
              .map(group => group.name));
          }
          else {
            const sdesc = parseSessionBody(s.body);
            const sAuthorExcluded = sdesc.chairs?.find(c => c.name?.toLowerCase() === 'author-');
            if (!sAuthorExcluded) {
              const common = session.chairs.find(c => c.login === s.author.login);
              if (common) {
                inboth.push(common.name ?? chair.login);
              }
            }
            inboth = inboth.concat(sdesc.chairs
              .filter(chair => session.chairs.find(c =>
                (c.login && c.login.toLowerCase() === chair.login?.toLowerCase()) ||
                (c.name && c.name.toLowerCase() === chair.name?.toLowerCase())))
              .map(chair => chair.name ?? chair.login));
          }
        }
        catch {}
        if (inboth.length > 0) {
          return { meeting, session, conflictsWith: s, names: inboth };
        }
        else {
          return null;
        }
      })
    )
    .flat()
    .filter(error => !!error);
  if (chairConflictErrors.length > 0) {
    errors.push({
      session: sessionNumber,
      severity: 'error',
      type: `${chairOrGroup} conflict`,
      messages: chairConflictErrors.map(err => `Session scheduled at the same time as "${err.conflictsWith.title}" (#${err.conflictsWith.number}), which shares ${chairOrGroup} ${err.names.join(', ')}`),
      details: chairConflictErrors
    });
  }

  // Check assigned slot is different from conflicting sessions
  // (skipped if the list of conflicting sessions is invalid)
  if (!hasConflictErrors && session.description.conflicts) {
    const conflictWarnings = meetings
      .filter(meeting => meeting.day && meeting.slot)
      .map(meeting => session.description.conflicts
        .map(number => {
          const conflictingSession = project.sessions.find(s => s.number === number);
          if (meetsInParallelWith(conflictingSession, meeting, project)) {
            return { meeting, session, conflictsWith: conflictingSession };
          }
          else {
            return null;
          }
        })
      )
      .flat()
      .filter(warning => !!warning);
    if (conflictWarnings.length > 0) {
      errors.push({
        session: sessionNumber,
        severity: 'warning',
        type: 'conflict',
        messages: conflictWarnings.map(c => `Same day/slot "${c.meeting.day} ${c.meeting.slot}" as conflicting session "${c.conflictsWith.title}" (#${c.conflictsWith.number})`),
        details: conflictWarnings
      });
    }
  }

  // Check absence of conflict with sessions in the same track(s)
  // Note: It's fine to have two plenary sessions in the same track(s)
  // scheduled in the same room and at the same time.
  const tracks = session.labels.filter(label => label.startsWith('track: '));
  const tracksWarnings = meetings
    .filter(meeting => meeting.day && meeting.slot)
    .map(meeting => tracks
      .map(track => project.sessions
        .filter(s => s !== session && s.labels.includes(track))
        .filter(s => meetsInParallelWith(s, meeting, project))
        .map(s => Object.assign({ meeting, track, session, conflictsWith: s }))
      )
    )
    .flat(2)
    .filter(warning => !!warning);
  if (tracksWarnings.length > 0) {
    errors.push({
      session: sessionNumber,
      severity: 'warning',
      type: 'track',
      messages: tracksWarnings.map(warn => `Same day/slot "${warn.meeting.day} ${warn.meeting.slot}" as session in same track "${warn.track}": "${warn.conflictsWith.title}" (#${warn.conflictsWith.number})`),
      details: tracksWarnings
    });
  }

  // Check that there is no plenary session scheduled at the same time as this
  // session
  const plenaryWarnings = meetings
    .filter(meeting => meeting.day && meeting.slot)
    .map(meeting => project.sessions
      .filter(s => s !== session && meetsInParallelWith(s, meeting, project))
      .filter(s => {
        try {
          const desc = parseSessionBody(s.body);
          return desc.type === 'plenary';
        }
        catch {
          return false;
        }
      })
      .map(s => `Session scheduled at the same time as plenary session "${s.title}" (#${s.number})`)
    )
    .flat()
    .filter(warning => !!warning);
  if (plenaryWarnings.length > 0) {
    errors.push({
      session: sessionNumber,
      severity: 'warning',
      type: 'plenary',
      messages: plenaryWarnings
    });
  }

  // No two sessions can use the same IRC channel during the same slot,
  // unless both sessions are part of the same plenary meeting.
  if (session.description.shortname) {
    const ircConflicts = meetings
      .filter(meeting => meeting.day && meeting.slot)
      .map(meeting => project.sessions
        .filter(s => s.number !== session.number && meetsInParallelWith(s, meeting, project))
        .filter(s => {
          try {
            const desc = parseSessionBody(s.body);
            return desc.shortname === session.description.shortname &&
              (desc.type !== 'plenary' || session.description.type !== 'plenary');
          }
          catch {
            return false;
          }
        })
      )
      .flat()
      .filter(error => !!error);
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
  if (project.metadata.type !== 'groups' &&
      hasActualMeeting(meetings) &&
      isMaterialMissing('minutes')) {
    const minutesNeeded = meetings
      .filter(meeting => meeting.room && meeting.day && meeting.slot)
      .find(meeting => {
        const day = project.days.find(d => d.name === meeting.day);
        const twoDaysInMs = 48 * 60 * 60 * 1000;
        return (
          (new Date()).getTime() -
          (new Date(day.date)).getTime()
        ) > twoDaysInMs;
      });
    if (minutesNeeded) {
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

  // Check the need to keep the "check: instructions" flag.
  // An admin may already have validated the instructions for meeting planners
  // (and removed the flag). We should only keep the flag if the instructions
  // section changed.
  const checkComments = errors.find(error =>
    error.severity === 'check' && error.type === 'instructions');
  if (checkComments &&
      !session.validation.check?.includes('instructions') &&
      changes?.body?.from) {
    try {
      const previousDescription = parseSessionBody(changes.body.from);
      const newDescription = parseSessionBody(session.body);
      if (newDescription.comments === previousDescription.comments) {
        errors = errors.filter(error =>
          !(error.severity === 'check' && error.type === 'instructions'));
      }
    }
    catch {
      // Previous version could not be parsed. Well, too bad, let's keep
      // the "check: comments" flag then.
      // TODO: consider doing something smarter as broken format errors
      // will typically arise when author adds links to agenda/minutes.
    }
  }

  return errors;
}