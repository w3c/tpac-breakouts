import { sendGraphQLRequest } from './graphql.mjs';
import { fetchW3CAccount } from './w3c.mjs';

/**
 * Retrieve information about session chairs in an array
 *
 * The session chairs include the session issue author and the additional
 * chairs listed as GitHub identities in the issue's body.
 *
 * Returned array contains, for each chair, an object with the user's:
 * - GitHub login
 * - GitHub avatar URL
 * - GitHub databaseId
 * - W3C account ID
 * - W3C account name
 * - W3C account email
 *
 * The object may only contain the GitHub login or the W3C account name.
 */
export async function fetchSessionChairs(session, chairs2W3CID) {
  const lcChairs2W3CID = {};
  for (const name of Object.keys(chairs2W3CID ?? {})) {
    lcChairs2W3CID[name.toLowerCase()] = chairs2W3CID[name];
  }
  const chairs = [];
  if (session.author) {
    if (!session.description.chairs ||
        !session.description.chairs.find(c => c.name?.toLowerCase() === 'author-')) {
      const w3cAccount = await fetchW3CAccount(session.author.databaseId);
      const chair = {
        databaseId: session.author.databaseId,
        login: session.author.login
      };
      if (w3cAccount) {
        chair.w3cId = w3cAccount.w3cId;
        chair.name = w3cAccount.name;
        chair.email = w3cAccount.email;
      }
      else if (lcChairs2W3CID[session.author.login.toLowerCase()]) {
        chair.w3cId = lcChairs2W3CID[session.author.login.toLowerCase()];
        chair.name = session.author.login;
      }
      chairs.push(chair);
    }
  }
  if (session.description.chairs) {
    for (const chairDesc of session.description.chairs) {
      if (chairDesc.name?.toLowerCase() === 'author-') {
        continue;
      }
      let chair = Object.assign({}, chairDesc);
      if (chair.login) {
        const githubAccount = await sendGraphQLRequest(`query {
          user(login: "${chair.login}") {
            databaseId
            login
          }
        }`);
        if (githubAccount.data.user) {
          chair.databaseId = githubAccount.data.user.databaseId;
          const w3cAccount = await fetchW3CAccount(chair.databaseId);
          if (w3cAccount) {
            chair.w3cId = w3cAccount.w3cId;
            chair.name = w3cAccount.name;
            chair.email = w3cAccount.email;
          }
          else if (lcChairs2W3CID[chair.login.toLowerCase()]) {
            chair.w3cId = lcChairs2W3CID[chair.login.toLowerCase()];
            chair.name = chair.login;
          }
        }
      }
      else if (lcChairs2W3CID[chair.name.toLowerCase()]) {
        chair.w3cId = lcChairs2W3CID[chair.name.toLowerCase()];
      }
      // Proposers sometimes add themselves as "additional" chairs,
      // creating duplicates. This makes the calendar code sad, because it
      // cannot add the same person twice to an event. Let's skip duplicates.
      const dupl = chairs.find(c =>
        (chair.login && c.login && chair.login === c.login) ||
        (chair.name && c.name && chair.name.toLowerCase() === c.name.toLowerCase()));
      if (!dupl) {
        chairs.push(chair);
      }
    }
  }
  return chairs;
}


/**
 * Validate the given list of session chairs, where each chair is represented
 * with an object that follows the same format as that returned by the
 * `fetchSessionChairs` function.
 * 
 * The function returns a list of errors (each error is a string), or an empty
 * array when the list looks fine. The function throws if the list is invalid,
 * in other words if it contains objects that don't have a `login` property.
 */
export function validateSessionChairs(chairs) {
  if (chairs.length === 0) {
    return ['Issue author is not a session chair, no other chair specified'];
  }
  return chairs
    .map(chair => {
      if (chair.login) {
        if (!chair.databaseId) {
          return `No GitHub account associated with "@${chair.login}"`;
        }
        if (!chair.w3cId) {
          return `No W3C account linked to the "@${chair.login}" GitHub account`;
        }
      }
      else if (chair.name) {
        if (!chair.w3cId) {
          return `No W3C account linked to "${chair.name}"`;
        }
      }
      else {
        throw new Error('Invalid chair object received in the list to validate');
      }
      return null;
    })
    .filter(error => !!error);
}