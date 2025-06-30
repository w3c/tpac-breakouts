import { getEnvKey } from './envkeys.mjs';
import wrappedFetch from './wrappedfetch.mjs';

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
    return json;
  }
  else if (res.status === 404) {
    return null;
  }
  else {
    throw new Error(`W3C server returned an unexpected HTTP status ${res.status} for GET request on registrants for ${project.metadata.slug}`);
  }
}


function mapRegistrantsToProject(project, registrants) {
  const sessions = project.sessions.map(session => {
    const meeting = registrants.meetings.find(meeting =>
      session.groups.length === meeting.groups.length &&
      session.groups.every(group =>
        meeting.groups.find(g => g.name === group.name)
      )
    );
    const res = { number: session.number };
    if (meeting) {
      res.chairs = meeting.chairs.map(person => Object.assign({
        name: person.name,
        email: person.email
      }));
      res.teamContacts = meeting['team-contacts'].map(person => Object.assign({
        name: person.name,
        email: person.email
      }));
      res.registrantsPerDay = meeting.sessions;
    }
    return res;
  });
  
}