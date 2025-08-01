/**
 * Handles synchronization with the W3C calendar using a dedicated API endpoint
 * with an authentication token.
 */

import { validateSession } from './validate.mjs';
import { updateSessionDescription } from './session.mjs';
import todoStrings from './todostrings.mjs';
import { computeSessionCalendarUpdates, meetsAt } from './meetings.mjs';
import wrappedFetch from './wrappedfetch.mjs';


/**
 * Helper function to retrieve the URL of the session agenda, if defined.
 *
 * The function first parses the agenda section. If it consists of a single
 * link, that link is the agenda URL. Otherwise, the function looks for a
 * possible agenda URL in the materials section (mainly for historical reason
 * because that is where we used to store the agenda URL).
 *
 * The function returns an empty string if it cannot find an agenda URL.
 */
function getAgendaUrl(session) {
  const agendaDesc = (session.description.agenda ?? '').trim();
  const match =
    agendaDesc.match(/^\[(.+)\]\((.*)\)$/i) ||
    agendaDesc.match(/^([^:]+):\s*(.*)$/i);
  if (match && !todoStrings.includes(match[2].toUpperCase())) {
    try {
      const url = new URL(match[2]);
      return url.toString();
    }
    catch (err) {
    }
  }
  const agendaMaterial = session.description.materials?.agenda ?? '@@';
  return todoStrings.includes(agendaMaterial) ? '' : agendaMaterial;
}


/**
 * Converts GitHub Flavoured Markdown to the markdown supported by the calendar
 * system and Bert's markdown to HTML converter.
 *
 * The function may need to be completed over time. So far, the only thing it
 * does is converting inline tabulations to spaces, because the conversion to
 * HTML would turn these tabulations into blockquotes otherwise.
 */
function convertToCalendarMarkdown(text) {
  if (!text) {
    return text;
  }
  return text.replace(/(\S)\t+/g, '$1 ');
}


/**
 * Helper function to format calendar entry description from the session's info
 */
function formatAgenda(session, options) {
  const issueUrl = `https://github.com/${session.repository}/issues/${session.number}`;
  const materials = Object.entries(session.description.materials || [])
    .filter(([key, value]) => (key !== 'agenda') && (key !== 'calendar'))
    .filter(([key, value]) => !todoStrings.includes(value))
    .map(([key, value]) => `- [${key}](${value})`);
  materials.push(`- [Session proposal on GitHub](${issueUrl})`);

  let tracksStr = '';
  if (options?.tracks === 'show') {
    const tracks = session.tracks ?? [];
    tracks.sort();
    if (tracks.length > 0) {
      tracksStr = `
**Track(s):**
${tracks.join('\n')}`;
    }
  }

  const attendanceStr = session.description.attendance === 'restricted' ? `
**Attendance:**
This session is restricted to TPAC registrants.` :
    '';

  const agendaUrl = getAgendaUrl(session);
  const detailedAgenda = agendaUrl ? null : session.description.agenda;
  const detailedAgendaStr = detailedAgenda ? `
**Agenda:**
${detailedAgenda}` :
    '';

  return `**Chairs:**
${session.chairs.map(chair => chair.name ?? '@' + chair.login).join(', ')}

**Description:**
${convertToCalendarMarkdown(session.description.description)}

**Goal(s):**
${convertToCalendarMarkdown(session.description.goal)}
${attendanceStr}
${detailedAgendaStr}

**Materials:**
${materials.join('\n')}
${tracksStr}`;
}


/**
 * Helper function to format the description of a plenary calendar entry
 * from a list of sessions.
 */
function formatPlenaryDescription(sessions) {
  const agendaItems = sessions.map(session => {
    const issueUrl = `https://github.com/${session.repository}/issues/${session.number}`;
    const chairs = session.chairs.map(chair => chair.name ?? '@' + chair.login).join(', ');
    return `- [${session.title.replace(/(\[\])/g, '\\$1')}](${issueUrl}) *(${chairs})*`;
  });
  return `The following proposals will be briefly presented:
${agendaItems.join('\n')}`;
}


/**
 * Helper function to format a plenary calendar entry agenda
 * from a list of sessions.
 *
 * Important:
 * - "plenary meeting" must appear somewhere, needed by isSharedCalendarEntry
 * - "**Agenda:**" must appear somewhere too, needed by removeFromCalendarEntry
 * - The list of sessions must appear after that heading as a '- ' list, needed
 * by isSharedCalendarEntry and removeFromCalendarEntry
 * - For each session, there must be a link to the underlying issue, needed by
 * assessCalendarEntry and removeFromCalendarEntry
 */
function formatPlenaryAgenda(sessions) {
  const agendaItems = sessions.map(session => {
    const issueUrl = `https://github.com/${session.repository}/issues/${session.number}`;
    const chairs = session.chairs.map(chair => chair.name ?? '@' + chair.login).join(', ');
    return `- [${session.title.replace(/([])/g, '\\$1')}](${issueUrl}) *(${chairs})*`;
  });

  return `**Description:**
During this plenary meeting, proposals will be briefly presented back to back.
Discussions will be limited to a couple of questions and answers, if time allows.

**Goals:**
Raise awareness, identify venue(s) for ongoing discussion.

**Agenda:**
${agendaItems.join('\n')}`;
}


/**
 * Return the order of the session in its plenary meeting if one exists, 999999
 * otherwise (to put the session last).
 *
 * The order of the session may be specified through an "order:x" note in the
 * project's "Note" field.
 */
function getPlenaryOrder(session) {
  const match = session.validation.note?.match(/order[:=]\s*(\d+)(?:\s|,|$)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  else {
    return 999999;
  }
}


/**
 * Retrieve the Zoom meeting link. Zoom info may be a string or an object
 * with a `link` property.
 */
function getZoomLink(zoomInfo) {
  if (!zoomInfo) {
    return '';
  }
  const link = typeof zoomInfo === 'string' ? zoomInfo : zoomInfo.link;
  if (!link || todoStrings.includes(link)) {
    return '';
  }
  else {
    return link;
  }
}


/**
 * Retrieve instructions to join the meeting through Zoom, if possible.
 */
function getZoomInstructions(zoomInfo) {
  if (!zoomInfo || typeof zoomInfo === 'string') {
    return '';
  }
  const link = getZoomLink(zoomInfo);
  const id = zoomInfo.id;
  const passcode = zoomInfo.passcode;
  if (!id) {
    return '';
  }
  if (!link.includes('/' + id.replace(/\s/g, ''))) {
    throw new Error(`Inconsistent Zoom info: meeting ID "${id}" could not be found in meeting link "${link}"`);
  }

  return `Join the Zoom meeting through:
${link}

Or join from your phone using one of the local phone numbers at:
https://w3c.zoom.us/u/kb8tBvhWMN

Meeting ID: ${id}
${passcode ? 'Passcode: ' + passcode : ''}
`;
}


async function importEvent(event, calendarServer, token) {
  calendarServer = calendarServer ?? 'www.w3.org';
  const url = `https://${calendarServer}/events/import/`;
  const response = await wrappedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `bearer ${token}`,
      'Accept': 'application/json'
    },
    body: JSON.stringify(event)
  });
  const json = await response.json();
  if (!json.event?.url) {
    throw new Error(`Unexpected response from W3C server on event import request`);
  }
  return json.event.url;
}


/**
 * Remove the given session from the agenda of the calendar entry
 *
 * The function looks for a certain pattern. It will not updated anything if
 * the agenda got customized somehow and uses a different pattern.
 */
async function removeFromCalendarEntry(
    { calendarUrl, session, project,
      calendarServer, author }) {
  throw new Error(`Removing an entry from a plenary session is no longer supported ${calendarUrl}`);
}

/**
 * Delete or cancel the calendar entry
 */
async function cancelCalendarEntry({
    calendarUrl, calendarServer, project,
    author, token }) {
  const calendarPath = calendarUrl.split('/');
  calendarPath.pop();
  const uuid = calendarPath.pop();
  if (!uuid.match(/^[0-9a-f\-]+$/)) {
    throw new Error(`Could not extract a uuid from ${calendarUrl}`);
  }

  // TODO: A draft entry cannot be canceled. It can only be deleted...
  // but there is no way to delete a draft entry using the API endpoint!
  // The following will fail with an internal server error if it is applied to
  // a draft entry.
  const json = {
    uuid,
    general: {
      'big-meeting': project.metadata.slug,
      category: project.metadata.type === 'groups' ?
        'group-meetings' :
        'breakout-sessions',
      status: 'canceled',
      author
    }
  };
  await importEvent(json, calendarServer, token);
}


/**
 * Create the required JSON structure for the W3C endpoint to create/update a
 * calendar entry.
 *
 * Function parameters should be relatively straightforward. The `status`
 * parameter tells whether calendar entries should be "draft", "tentative" or
 * "confirmed".
 */
export function convertEntryToJSON({
    entry, session, project,
    status, zoom, author }) {
  // Compute room location label
  let roomLocation = '';
  if (project.metadata.rooms === 'hide') {
    const roomIdx = project.rooms.findIndex(room => room.name === entry.meeting.room);
    roomLocation = 'R' + (roomIdx < 9 ? '0' : '') + (roomIdx + 1);
  }
  else {
    const room = project.rooms.find(room => room.name === entry.meeting.room);
    roomLocation = (room?.location ? room.location + ' - ' : '') + (room?.name ?? '');
  }

  const res = {
    general: {
      title: session.title,
      description: '',
      location: roomLocation,
      'big-meeting': project.metadata.slug,
      category: project.metadata.type === 'groups' ?
        'group-meetings' :
        'breakout-sessions',
      visibility: 'public',
      status,
      author
    },
    dates: {
      start: `${entry.day} ${entry.start}:00`,
      end: `${entry.day} ${entry.end}:00`,
      timezone: project.metadata.timezone
    },
    participants: {},
    joining: {
      chat: ''
    }
  };

  // Complete main info
  if (session.description.type === 'plenary') {
    const sessions = project.sessions
      .filter(s => meetsAt(s, entry, project))
      .sort((session1, session2) => {
        const order1 = getPlenaryOrder(session1);
        const order2 = getPlenaryOrder(session2);
        const compare = order1 - order2;
        if (compare === 0) {
          compare = session1.number - session2.number;
        }
        return compare;
      });
    res.general.title = 'Plenary session';
    res.general.description = formatPlenaryDescription(sessions);
    res.joining.chat = `https://webirc.w3.org/?channels=${encodeURIComponent(`plenary`)}`;
    res.agenda = {
      url: '',
      agenda: formatPlenaryAgenda(sessions)
    };
  }
  else {
    res.general.title = session.title;
    if (session.description.discussion) {
      res.joining.chat = session.description.discussion;
    }
    else if (session.description.shortname) {
      res.joining.chat = `https://webirc.w3.org/?channels=${encodeURIComponent(session.description.shortname.replace(/#/, ''))}`;
    }

    // Always update the next few fields for breakout sessions,
    // only if there is some actual info to set for group meetings
    // (group meetings issues typically do not contain anything about agendas
    // or descriptions, and group chairs may adjust the calendar entries
    // themselves, so let's preserve the info by default)
    if (project.metadata.type !== 'groups' || getAgendaUrl(session)) {
      if (!res.agenda) {
        res.agenda = {};
      }
      res.agenda.url = getAgendaUrl(session);
    }
    if (project.metadata.type !== 'groups') {
      if (!res.agenda) {
        res.agenda = {};
      }
      res.agenda.agenda = formatAgenda(session, { tracks: project.metadata.tracks });
    }
    if (project.metadata.type !== 'groups' || convertToCalendarMarkdown(session.description.description)) {
      res.general.description = convertToCalendarMarkdown(session.description.description);
    }
  }

  // Complete with Zoom info
  if (getZoomLink(zoom)) {
    res.joining = Object.assign(res.joining, {
      visibility: 'member',
      url: getZoomLink(zoom),
      instructions: getZoomInstructions(zoom)
    });
  }
  else {
    // No Zoom info? Let's preserve what the calendar entry may already contain.
  }

  // Add link to minutes if they exist
  const minutesMaterial = session.description.materials?.minutes ?? '@@';
  const minutesUrl = todoStrings.includes(minutesMaterial) ? undefined : minutesMaterial;
  if (project.metadata.type !== 'groups' || minutesUrl) {
    res.minutes = { url: minutesUrl };
  }

  // Add groups/chairs as individual attendees
  // Note: the select field is hidden so attendees will only appear once
  // calendar entry has been submitted.
  // Note: we preserve the former list of individual attendees because people
  // may subscribe to an event at any time, but don't preserve the former list
  // of group attendees
  if (project.metadata.type === 'groups') {
    const groups = session.groups.filter(group =>
      group.w3cId && group.w3cId !== -1 &&
      typeof group.w3cId === 'number');
    if (groups.length > 0) {
      res.participants.groups = groups.map(group => group.w3cId);
    }
  }
  else if (status === 'draft' || !entry.url) {
    // Note: we're only going to change the list of individuals when the entry
    // gets created or when it's still a draft, because external people may
    // subscribe to the entry otherwise.
    const chairs = session.chairs.filter(chair =>
      chair.w3cId && chair.w3cId !== -1 &&
      typeof chair.w3cId === 'number');
    res.participants.individuals = chairs.map(chair => chair.w3cId);
  }

  // For group meetings and restricted breakout sessions, tick the restrict
  // attendance box and show joining information to people invited to the event
  // and holders of a W3C account with Member access.
  // Show information to everyone with a W3C account otherwise.
  if ((project.metadata.type === 'groups') ||
      (session.description.attendance === 'restricted')) {
    // TODO: Need a way to check the "big meeting restricted" flag
    res.joining.visibility = 'member';
  }
  else {
    // TODO: Need a way to uncheck the "big meeting restricted" flag
    res.joining.visibility = 'registered';
  }

  // Add UUID for an existing entry
  if (entry.url) {
    const calendarPath = entry.url.split('/');
    calendarPath.pop();
    res.uuid = calendarPath.pop();
    if (!res.uuid.match(/^[0-9a-f\-]+$/)) {
      throw new Error(`Could not extract a uuid from ${entry.url}`);
    }
  }

  return res;
}


/**
 * Synchronize session information with calendar information
 *
 * That synchronization is a 1-to-1 mapping for pure breakout sessions.
 * It is a many-to-1 mapping for plenary sessions.
 * And a 1-to-many mapping for group meetings.
 *
 * As much as practical, existing calendar entries will be reused, see the
 * logic in `meetings.mjs`.
 *
 * Function parameters should be relatively straightforward. The `status`
 * parameter tells whether calendar entries should be "draft", "tentative" or
 * "confirmed".
 */
export async function synchronizeSessionWithCalendar(
    { session, status, project,
      calendarServer, token, author }) {
  // First, retrieve known information about the project and the session,
  // and make sure the session is valid.
  const sessionErrors = (await validateSession(session.number, project))
    .filter(error => error.severity === 'error');
  if (sessionErrors.length > 0) {
    throw new Error(`Session ${session.number} contains errors that need fixing`);
  }

  // Compute the list of calendar updates that we need to do to synchronize
  // the session's information with the calendar. If there's nothing to do,
  // that's cool, let's not do anything!
  const actions = computeSessionCalendarUpdates(session, project);
  if (actions.cancel.length === 0 &&
      actions.update.length === 0 &&
      actions.create.length === 0) {
    console.log(`- no calendar updates needed`);
    return;
  }

  // If session is a plenary session, retrieve known information about other
  // sessions in the same plenary. To avoid creating a mess in the calendar,
  // we'll throw if one of these sessions has an error that needs fixing.
  if (session.description.type === 'plenary') {
    const meetingEntry = actions.update[0] ?? actions.create[0];
    const sessions = project.sessions
      .filter(s => s !== session && meetsAt(s, meetingEntry.meeting, project));
    for (const s of sessions) {
      const errors = (await validateSession(s, project))
        .filter(error => error.severity === 'error');
      if (errors.length > 0) {
        throw new Error(`Session ${session.number} is in the same plenary as session ${s.number}, which contains errors that need fixing`);
      }
      // TODO: Chair name should be known for those who linked their GitHub
      // profile with their W3C account, but not for others. We used to
      // retrieve that information using Puppeteer. There is no way to do that
      // through an HTTP endpoint for now.
    }
  }

  // Retrieve detailed information about the session's chairs, unless we're
  // dealing with a group meeting
  if (project.metadata.type !== 'groups') {
    // TODO: Same problem as above
  }

  for (const entry of actions.cancel) {
    if (session.description.type === 'plenary') {
      // TODO: cancel instead of remove if session is the only one left in
      // the plenary meeting.
      console.log(`- remove from plenary calendar entry ${entry.url}`);
      await removeFromCalendarEntry({
        calendarUrl: entry.url, session,
        calendarServer, status,
        project, author, token
      });
    }
    else {
      console.log(`- delete/cancel calendar entry ${entry.url}`);
      await cancelCalendarEntry({
        calendarUrl: entry.url,
        calendarServer,
        project, author, token
      });
    }
  }

  for (const entry of actions.update) {
    console.log(`- refresh calendar entry ${entry.url}, meeting in ${entry.meeting.room} on ${entry.day} ${entry.start} - ${entry.end}`);
    const room = project.rooms.find(room => room.name === entry.meeting.room);
    const zoom = project.metadata.rooms === 'hide' ? null : room;
    entry.url = await updateCalendarEntry({
      calendarServer,
      entry, session, project,
      status, zoom, author, token
    });
  }

  for (const entry of actions.create) {
    console.log(`- create new calendar entry, meeting in ${entry.meeting.room} on ${entry.day} ${entry.start} - ${entry.end}`);
    const room = project.rooms.find(room => room.name === entry.meeting.room);
    const zoom = project.metadata.rooms === 'hide' ? null : room;
    entry.url = await updateCalendarEntry({
      calendarServer,
      entry, session, project,
      status, zoom, author, token
    });
  }

  console.log(`- add calendar entries to session description`);
  const entries = actions.update.concat(actions.create);
  entries.sort((e1, e2) => {
    if (e1.day < e2.day) {
      return -1;
    }
    else if (e1.day > e2.date) {
      return 1;
    }
    else {
      return e1.start - e2.start;
    }
  });
  // Same view using day labels instead of full day identifiers
  const entriesDesc = entries.map(entry => {
    const day = project.slots.find(day => day.date === entry.day);
    const desc = {
      day: day.weekday ?? day.name,
      start: entry.start,
      end: entry.end,
      url: entry.url
    }
    if (entry.type === 'plenary') {
      desc.type = 'plenary';
    }
    return desc;
  });
  session.description.calendar = entriesDesc;
  await updateSessionDescription(session);
}

/**
 * Create/Update calendar entry for the given meeting
 */
async function updateCalendarEntry(
    { calendarServer, entry, session, project,
      status, zoom, author, token }) {
  const json = convertEntryToJSON({
    entry, session, project,
    status, zoom, author
  });
  const entryUrl = await importEvent(json, calendarServer, token);
  console.log(`- calendar entry created/updated: ${entryUrl}`);
  return entryUrl;
}
