import { getEnvKey } from './envkeys.mjs';
import wrappedFetch from './wrappedfetch.mjs';

function normalizeTitle(title) {
  return title
    .replace(/ (BG|Business Group)($|,| and| &|:|>)/gi, ' BG$2')
    .replace(/ (CG|Community Group)($|,| and| &|:|>)/gi, ' CG$2')
    .replace(/ (IG|Interest Group)($|,| and| &|:|>)/gi, ' IG$2')
    .replace(/ (WG|Working Group)($|,| and| &|:|>)/gi, ' WG$2')
    .replace(/ (TF|Task Force)($|,| and| &|:|>)/gi, ' TF$2')
    .trim();
}

/**
 * Collect information about group meetings from the registration system.
 *
 * Main piece of information is the list of registrants for each and every
 * meeting. The information also includes the emails of the group chairs
 * and staff contacts.
 */
export async function fetchRegistrants(project) {
  if (!project.metadata.slug) {
    throw new Error('Big meeting slug is missing');
  }

  const W3C_TOKEN = await getEnvKey('W3C_TOKEN');
  let res = await wrappedFetch(
    `https://www.w3.org/register/${project.metadata.slug}/stats/`,
    {
      method: 'GET',
      headers: {
        'Authorization': `token ${W3C_TOKEN}`,
        'Accept': 'application/json'
      }
    }
  );
  if (res.status === 200) {
    const json = await res.json();
    for (const meeting of json?.meetings ?? []) {
      for (const group of meeting.groups) {
        group.name = normalizeTitle(group.name);
      }
      // Pretend that groups that don't exist yet actually exist
      // TODO: find a way to handle non existing groups in joint meetings
      if (meeting.groups.length === 0) {
        meeting.groups.push({
          name: normalizeTitle(meeting.name)
        });
      }
    }
    mapRegistrantsToProject(project, json);
    return;
  }
  else if (res.status === 404) {
    return;
  }
  else {
    throw new Error(`W3C server returned an unexpected HTTP status ${res.status} for GET request on registrants for ${project.metadata.slug}`);
  }
}


function mapRegistrantsToProject(project, registrants) {
  project.registrants = [];
  for (const session of project.sessions) {
    const sessionRegistrants =
      registrants.meetings?.find(meeting =>
        session.groups.length === meeting.groups.length &&
        session.groups.every(group =>
          meeting.groups.find(g => g.name === group.name)
        )) ||
      registrants.meetings?.find(meeting =>
        normalizeTitle(session.title) === normalizeTitle(meeting.name));
    if (sessionRegistrants) {
      session.people = sessionRegistrants.chairs
        .map(person => Object.assign({
            name: person.name,
            email: person.email,
            type: 'Chair'
          }))
        .concat(
          sessionRegistrants['team-contacts']
            .map(person => Object.assign({
              name: person.name,
              email: person.email,
              type: 'Team contact'
            })));
    }
    else {
      console.warn(session.number, session.title,
        session.groups.map(g => g.name).join(', '),
        'not found in registrants stats');
      session.people = [];
    }
    for (const meeting of session.meetings ?? []) {
      const meetingRegistrants = sessionRegistrants
        ?.sessions
        ?.find(m => m.day === meeting.day);
      if (meetingRegistrants) {
        meeting.participants = meetingRegistrants['physical-participants'];
        meeting.observers = meetingRegistrants['physical-observers'];
      }
      else {
        meeting.participants = 0;
        meeting.observers = 0;
      }
    }
    if (session.meetings?.length > 0) {
      session.participants = Math.max(...session.meetings.map(m => m.participants));
      session.observers = Math.max(...session.meetings.map(m => m.observers));
    }
    else {
      session.participants = 0;
      session.observers = 0;
    }

    // Save raw numbers as well to allow scheduler to run from scratch
    if (sessionRegistrants) {
      project.registrants.push({
        number: session.number,
        participants: (sessionRegistrants.sessions?.length > 0) ?
          Math.max(...sessionRegistrants.sessions.map(m => m['physical-participants'])) :
          0,
        observers: (sessionRegistrants.sessions?.length > 0) ?
          Math.max(...sessionRegistrants.sessions.map(m => m['physical-observers'])) :
          0
      });
    }
  }
}