import { validateSession } from './validate.mjs';
import { updateSessionDescription } from './session.mjs';
import { todoStrings } from './todostrings.mjs';
import { computeSessionCalendarUpdates, meetsAt } from './meetings.mjs';


/**
 * Retrieve the name of a chair from their W3C ID
 */
async function fetchChairName({ chair, browser, login, password }) {
  console.log(`- fetch chair name for ${chair.login}`);
  const page = await browser.newPage();
  const url = `https://www.w3.org/users/${chair.w3cId}/`
  try {
    await page.goto(url);
    await authenticate(page, login, password, url);
    chair.name = await page.evaluate(() => {
      const el = document.querySelector('main h1');
      return el.textContent.trim();
    });
  }
  finally {
    await page.close();
  }
}


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
function formatAgenda(session) {
  const issueUrl = `https://github.com/${session.repository}/issues/${session.number}`;
  const materials = Object.entries(session.description.materials || [])
    .filter(([key, value]) => (key !== 'agenda') && (key !== 'calendar'))
    .filter(([key, value]) => !todoStrings.includes(value))
    .map(([key, value]) => `- [${key}](${value})`);
  materials.push(`- [Session proposal on GitHub](${issueUrl})`);

  const tracks = session.labels
    .filter(label => label.startsWith('track: '))
    .map(label => '- ' + label.substring('track: '.length));
  tracks.sort();
  const tracksStr = tracks.length > 0 ? `
**Track(s):**
${tracks.join('\n')}` :
    '';

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
    throw new Error(`Inconsistent info in ROOM_ZOOM: meeting ID "${id}" could not be found in meeting link "${link}"`);
  }

  return `Join the Zoom meeting through:
${link}

Or join from your phone using one of the local phone numbers at:
https://w3c.zoom.us/u/kb8tBvhWMN

Meeting ID: ${id}
${passcode ? 'Passcode: ' + passcode : ''}
`;
}


/**
 * Login to W3C server.
 *
 * The function throws if login fails.
 */
export async function authenticate(page, login, password, redirectUrl) {
  const url = await page.evaluate(() => window.location.href);
  if (!url.endsWith('/login')) {
    return;
  }

  const usernameInput = await page.waitForSelector('input#username');
  await usernameInput.type(login);

  const passwordInput = await page.waitForSelector('input#password');
  await passwordInput.type(password);

  const submitButton = await page.waitForSelector('button[type=submit]');
  await submitButton.click();

  await page.waitForNavigation();
  const newUrl = await page.evaluate(() => window.location.href);
  if (newUrl !== redirectUrl) {
    throw new Error('Could not login. Invalid credentials?');
  }
}


/**
 * Make sure that the calendar entry loaded in the given browser's page links
 * back to the given session.
 * 
 * The function throws if that's not the case.
 */
async function assessCalendarEntry(page, session) {
  const issueUrl = `https://github.com/${session.repository}/issues/${session.number}`;
  const desc = await page.$eval('textarea#event_agenda', el => el.value);
  if (!desc) {
    throw new Error('No detailed agenda in calendar entry');
  }
  if (!desc.includes(`](${issueUrl})`)) {
    // Note the check could perhaps be tightened:
    // a session could potentially link to another session in its description.
    throw new Error('Calendar entry does not link back to GitHub issue');
  }
}


/**
 * Determines whether the calendar entry loaded in the given browser's page
 * is shared between sessions.
 *
 * Note that the function returns false if the calendar entry is for a plenary
 * meeting that only links to one session.
 */
async function isSharedCalendarEntry(page, session) {
  const desc = await page.$eval('textarea#event_agenda', el => el.value);
  if (!desc) {
    throw new Error('No detailed agenda in calendar entry');
  }
  if (desc.includes('plenary meeting')) {
    return desc.match(/- \[/g)?.length > 1;
  }
  else {
    return false;
  }
}



/**
 * Fill/Update calendar entry loaded in the given browser's page with the
 * session's info.
 *
 * The function returns the URL of the calendar entry, once created/updated.
 */
async function fillCalendarEntry({ page, entry, session, project, status, zoom }) {
  async function selectEl(selector) {
    const el = await page.waitForSelector(selector);
    if (!el) {
      throw new Error(`No element in page that matches "${selector}"`);
    }
    return el;
  }
  async function fillTextInput(selector, value) {
    const el = await selectEl(selector);

    // Clear input (select all and backspace!)
    // Note this should use platform-specific commands in theory
    // ... but that would not work on Mac in any case, see:
    // https://github.com/puppeteer/puppeteer/issues/1313
    await el.click({ clickCount: 1 });
    await page.keyboard.down('ControlLeft');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('ControlLeft');
    await el.press('Backspace');

    if (value) {
      await el.type(value);
    }
  }
  async function clickOnElement(selector) {
    const el = await selectEl(selector);
    await el.click();
  }
  async function chooseOption(selector, value) {
    const el = await selectEl(selector);
    await el.select(value);
  }

  // Note statuses are different when calendar entry has already been flagged as
  // "tentative" or "confirmed" ("draft" no longer exists in particular).
  status = status ?? 'draft';
  await page.$eval(`input[name="event[status]"][value=${status}]`, el => el.click());

  const room = (project.metadata.rooms === 'hide') ?
    null :
    project.rooms.find(room => room.name === entry.meeting.room);
  const roomLocation = (room?.label ?? '') + (room?.location ? ' - ' + room.location : '');
  await fillTextInput('input#event_location', roomLocation ?? '');

  // All events are visible to everyone
  await clickOnElement('input#event_visibility_0');

  const day = project.days.find(day => day.name === entry.day);
  await page.evaluate(`window.tpac_breakouts_date = "${day.date}";`);
  await page.$eval('input#event_start_date', el => el.value = window.tpac_breakouts_date);
  await page.$eval('input#event_start_date', el => el.value = window.tpac_breakouts_date);

  await chooseOption('select#event_start_time_hour', `${parseInt(entry.start.split(':')[0], 10)}`);
  await chooseOption('select#event_start_time_minute', `${parseInt(entry.start.split(':')[1], 10)}`);
  await chooseOption('select#event_end_time_hour', `${parseInt(entry.end.split(':')[0], 10)}`);
  await chooseOption('select#event_end_time_minute', `${parseInt(entry.end.split(':')[1], 10)}`);

  await chooseOption('select#event_timezone', project.metadata.timezone);

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
      await page.evaluate(`window.tpac_groups = ${JSON.stringify(groups, null, 2)};`);
      await page.$eval('select#event_groups', el => el.innerHTML +=
        window.tpac_groups
          .filter(group => !el.querySelector(`option[selected][value="${group.w3cId}"]`))
          .map(group => `<option value="${group.w3cId}" selected="selected">${group.name}</option>`)
          .join('\n')
      );
    }
  }
  else {
    const chairs = session.chairs.filter(chair =>
      chair.w3cId && chair.w3cId !== -1 &&
      typeof chair.w3cId === 'number');
    if (chairs.length > 0) {
      await page.evaluate(`window.tpac_breakouts_chairs = ${JSON.stringify(chairs, null, 2)};`);
      await page.$eval('select#event_individuals', el => el.innerHTML +=
        window.tpac_breakouts_chairs
          .filter(chair => !el.querySelector(`option[selected][value="${chair.w3cId}"]`))
          .map(chair => `<option value="${chair.w3cId}" selected="selected">${chair.name}</option>`)
          .join('\n')
      );
    }
  }

  // Show joining information to "Holders of a W3C account", unless session is restricted
  // to TPAC registrants
  await clickOnElement('input#event_joinVisibility_' + (session.description.attendance === 'restricted' ? '2' : '1'));

  if (getZoomLink(zoom)) {
    await fillTextInput('input#event_joinLink', getZoomLink(zoom));
    await fillTextInput('textarea#event_joiningInstructions', getZoomInstructions(zoom));
  }
  else {
    // No Zoom info? Let's preserve what the calendar entry may already contain.
  }

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
    await fillTextInput('input#event_title', 'Plenary session');
    await fillTextInput('textarea#event_description', formatPlenaryDescription(sessions));
    await fillTextInput('input#event_chat',
      `https://irc.w3.org/?channels=${encodeURIComponent(`#plenary`)}`);
    await fillTextInput('input#event_agendaUrl', '');
    await fillTextInput('textarea#event_agenda', formatPlenaryAgenda(sessions));
  }
  else {
    await fillTextInput('input#event_title', session.title);
    await fillTextInput('textarea#event_description', convertToCalendarMarkdown(session.description.description));
    if (session.description.discussion) {
      await fillTextInput('input#event_chat', session.description.discussion);
    }
    else if (session.description.shortname) {
      await fillTextInput('input#event_chat',
        `https://irc.w3.org/?channels=${encodeURIComponent(session.description.shortname)}`);
    }
    await fillTextInput('input#event_agendaUrl', getAgendaUrl(session));
    if (project.metadata.type !== 'groups') {
      await fillTextInput('textarea#event_agenda', formatAgenda(session));
    }
  }

  const minutesMaterial = session.description.materials?.minutes ?? '@@';
  const minutesUrl = todoStrings.includes(minutesMaterial) ? undefined : minutesMaterial;
  await fillTextInput('input#event_minutesUrl', minutesUrl);

  // Big meeting is something like "TPAC 2023", not the actual option value
  await page.evaluate(`window.tpac_breakouts_meeting = "${project.metadata.meeting}";`);
  await page.$$eval('select#event_big_meeting option', options => options.forEach(el =>
    el.selected = el.innerText.startsWith(window.tpac_breakouts_meeting)));
  await chooseOption('select#event_category',
    project.metadata.type === 'groups' ? 'group-meetings' : 'breakout-sessions');

  // Click on "Create/Update but don't send notifications" button
  // and return URL of the calendar entry
  await clickOnElement(status === 'draft' ?
    'button#event_submit' :
    'button#event_no_notif');
  await page.waitForNavigation();
  const calendarUrl = await page.evaluate(() => window.location.href);
  if (calendarUrl.endsWith('/new/') || calendarUrl.endsWith('/edit/')) {
    throw new Error('Calendar entry submission failed');
  }
  return calendarUrl;
}


/**
 * Remove the given session from the agenda of the calendar entry loaded in the
 * given browser page.
 *
 * The function looks for a certain pattern. It will not updated anything if
 * the agenda got customized somehow and uses a different pattern.
 */
async function removeFromCalendarEntry(
    { calendarUrl, session,
      browser, calendarServer, login, password, status }) {
  function getUpdatedList(list) {
    return list
      .split('\n')
      .filter(item => !item.includes(`issues/${session.number})`))
      .join('\n');
  }

  const calendarEditUrl = `${calendarUrl.replace(/www\.w3\.org/, calendarServer)}edit/`;
  console.log(`- load calendar edit page: ${calendarEditUrl}`);
  const page = await browser.newPage();

  try {
    await page.goto(calendarEditUrl);
    await authenticate(page, login, password, calendarEditUrl);

    const description = await page.$eval('textarea#event_description', el => el.value);
    const descItemsStart = description.indexOf('- ');
    const descItems = getUpdatedList(description.substring(descItemsStart));
    const newDescription = description.substring(descItemsStart) + descItems;
    await fillTextInput('textarea#event_agenda', newDescription);

    const agenda = await page.$eval('textarea#event_agenda', el => el.value);
    const agendaItemsStart = agenda.indexOf('**Agenda:**\n') + '**Agenda:**\n'.length;
    const agendaItems = getUpdatedList(agenda.substring(agendaItemsStart));
    const newAgenda = agenda.substring(agendaItemsStart) + agendaItems;
    await fillTextInput('textarea#event_agenda', newAgenda);

    const el = await page.waitForSelector(status === 'draft' ?
      'button#event_submit' :
      'button#event_no_notif');
    await el.click();
    await page.waitForNavigation();
  }
  finally {
    await page.close();
  }
}


/**
 * Delete or cancel the calendar entry loaded in the given browser page.
 */
async function cancelCalendarEntry(
    { calendarUrl, browser, calendarServer, login, password }) {
  const calendarEditUrl = `${calendarUrl.replace(/www\.w3\.org/, calendarServer)}edit/`;
  console.log(`- load calendar edit page: ${calendarEditUrl}`);
  const page = await browser.newPage();

  let resolveDeleted;
  const deleted = new Promise(resolve => {
    resolveDeleted = resolve;
  });
  page.on('dialog', async dialog => {
    await dialog.accept();
    await page.waitForNavigation();
    resolveDeleted();
  });

  try {
    await page.goto(calendarEditUrl);
    await authenticate(page, login, password, calendarEditUrl);

    await page.$eval('input[value=DELETE]', el =>
      el.parentElement.querySelector('button').click());
    return deleted;
  }
  catch (err) {
    // No way to click the delete button? That means the event is not a draft.
    // It cannot be deleted, let's cancel it instead.
    await page.$eval(`input[name="event[status]"][value=canceled]`, el => el.click());
    const el = await page.waitForSelector('button#event_no_notif');
    await el.click();
    await page.waitForNavigation();
  }
  finally {
    await page.close();
  }
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
 * "confirmed". The `roomZoom` parameter provides the mapping between room
 * names and Zoom info.
 */
export async function synchronizeSessionWithCalendar(
    { browser, session, project, calendarServer, login, password, status, roomZoom }) {
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
      for (const chair of s.chairs) {
        if (chair.name === chair.login && chair.w3cId) {
          await fetchChairName({ chair, browser, login, password });
        }
      }
    }
  }

  // Retrieve detailed information about the session's chairs, unless we're
  // dealing with a group meeting
  if (project.metadata.type !== 'groups') {
    for (const chair of session.chairs) {
      if (chair.name === chair.login && chair.w3cId) {
        await fetchChairName({ chair, browser, login, password });
      }
    }
  }

  for (const entry of actions.cancel) {
    if (session.description.type === 'plenary') {
      // TODO: cancel instead of remove if session is the only one left in
      // the plenary meeting.
      console.log(`- remove from plenary calendar entry ${entry.url}`);
      await removeFromCalendarEntry({
        calendarUrl: entry.url, session,
        browser, calendarServer, login, password, status
      });
    }
    else {
      console.log(`- delete/cancel calendar entry ${entry.url}`);
      await cancelCalendarEntry({
        calendarUrl: entry.url,
        browser, calendarServer, login, password
      });
    }
  }

  for (const entry of actions.update) {
    console.log(`- refresh calendar entry ${entry.url}, meeting in ${entry.meeting.room} on ${entry.day} ${entry.start} - ${entry.end}`);
    const room = project.rooms.find(room => room.name === entry.meeting.room);
    const zoom = project.metadata.rooms === 'hide' ? null : roomZoom[room.label];
    entry.url = await updateCalendarEntry({
      calendarUrl: entry.url,
      calendarServer,
      entry, session, project,
      browser, login, password, status, zoom
    });
  }

  for (const entry of actions.create) {
    console.log(`- create new calendar entry, meeting in ${entry.meeting.room} on ${entry.day} ${entry.start} - ${entry.end}`);
    const room = project.rooms.find(room => room.name === entry.meeting.room);
    const zoom = project.metadata.rooms === 'hide' ? null : roomZoom[room.label];
    entry.url = await updateCalendarEntry({
      calendarUrl: null,
      calendarServer,
      entry, session, project,
      browser, login, password, status, zoom
    });
  }

  console.log(`- add calendar entries to session description`);
  const entries = actions.update.concat(actions.create);
  entries.sort((e1, e2) => {
    const day1 = project.days.find(day => day.name === e1.day);
    const day2 = project.days.find(day => day.name === e2.day);
    if (day1.date < day2.date) {
      return -1;
    }
    else if (day1.date > day2.date) {
      return 1;
    }
    else {
      return e1.start - e2.start;
    }
  });
  // Same view using day labels instead of full day identifiers
  const entriesDesc = entries.map(entry => {
    const day = project.days.find(day => day.name === entry.day);
    const desc = {
      day: day.label ?? day.name,
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
    { calendarUrl, calendarServer, entry, session, project,
      browser, login, password, status, zoom }) {
  const calendarEditUrl = calendarUrl ?
    `${calendarUrl.replace(/www\.w3\.org/, calendarServer)}edit/` :
    `https://${calendarServer}/events/meetings/new/`;
  console.log(`- load calendar edit page: ${calendarEditUrl}`);
  const page = await browser.newPage();

  try {
    await page.goto(calendarEditUrl);
    await authenticate(page, login, password, calendarEditUrl);

    // TODO: this disables the security check, which sort of works
    // for group meetings provided that the repository remains private.
    // That's not fantastic though, find a better way!
    if (calendarUrl && project.metadata.type !== 'groups') {
      console.log('- make sure calendar entry is linked to the session');
      await assessCalendarEntry(page, session);

      console.log('- assess the type of the calendar entry');
      const sharedCalendarEntry = await isSharedCalendarEntry(page, session);
      if (sharedCalendarEntry) {
        console.log('- calendar entry is shared between sessions');
      }
      else {
        console.log('- calendar entry is specific to this session');
      }
    }

    const newCalendarUrl = await fillCalendarEntry({
      page, entry, session, project, status, zoom
    });
    console.log(`- calendar entry created/updated: ${newCalendarUrl}`);

    return newCalendarUrl;
  }
  finally {
    await page.close();
  }
}
