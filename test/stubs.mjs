/**
 * This module creates stubs for the functions that fetch data from the
 * network, replacing content with test data as appropriate. The stub functions
 * are only meant for testing purpose!
 */

import { getEnvKey } from '../tools/lib/envkeys.mjs';

/**
 * A unique ID counter
 */
let uid = 0;

/**
 * Users appear one after the other. We'll create fake `databaseId` properties
 * for them as needed. To ensure consistency across tests, we'll cache these
 * assignments.
 */
let userCache = [];

/**
 * Prepare the test data from the given test data identifier. Note we'll do
 * things only once and cache the response, so that identifiers don't change
 * from one function call to the next.
 */
let testDataCache = {};
async function getTestData(testDataId) {
  if (testDataCache[testDataId]) {
    return JSON.parse(JSON.stringify(testDataCache[testDataId]));
  }

  let custom;
  try {
    custom = (await import(`./data/${testDataId}.mjs`)).default;
  }
  catch {
    custom = {};
  }

  function toGraphQLNameList(arr) {
    return arr.map(name => Object.assign({ id: `id_${uid++}`, name }));
  }

  function toGraphQLAuthor(login) {
    let user = userCache.find(user => user.login === login);
    if (!user) {
      user = { login, databaseId: custom.w3cAccounts?.[login] ?? uid++ };
      userCache.push(user);
    }
    return Object.assign({}, user);
  }

  function toGraphQLSessions(arr) {
    return arr.map(toGraphQLSession);
  }

  let sessionNumber = 1;
  function toGraphQLSession(session) {
    const fields = [];
    for (const field of ['Room', 'Day', 'Slot']) {
      if (session[field.toLowerCase()]) {
        fields.push({
          name: session[field.toLowerCase()],
          field: { name: field }
        });
      }
    }
    for (const field of ['Error', 'Warning', 'Check', 'Note']) {
      if (session[field.toLowerCase()]) {
        fields.push({
          text: session[field.toLowerCase()],
          field: { name: field }
        });
      }
    }

    return {
      id: `id_${uid++}`,
      content: {
        id: `id_${uid++}`,
        repository: {
          owner: {
            login: 'w3c'
          },
          name: 'tpac-breakouts',
          nameWithOwner: 'w3c/tpac-breakouts'
        },
        number: session.number ?? sessionNumber++,
        state: 'OPEN',
        title: session.title ?? `A session for ${testDataId}`,
        body: session.body ?? '',
        labels: {
          nodes: toGraphQLNameList(session.labels ?? ['session'])
        },
        author: toGraphQLAuthor(session.author ?? 'testbot')
      },
      fieldValues: {
        nodes: fields
      }
    }
  };

  const testData = {
    url: `https://github.com/orgs/w3c/projects/${testDataId}`,
    id: `id_project_${testDataId}`,
    title: custom.title ?? testDataId,
    shortDescription: custom.description ?? 'meeting: Breakouts Test Event, timezone: Etc/UTC',
    rooms: toGraphQLNameList(custom.rooms ?? ['Panic room (25)']),
    days: toGraphQLNameList(custom.days ?? ['Monday (2042-04-07)']),
    slots: toGraphQLNameList(custom.slots ?? ['9:00 - 10:00']),
    labels: toGraphQLNameList(custom.labels ?? ['session']),
    sessions: toGraphQLSessions(custom.sessions ?? [
      { number: 1, title: 'A test session' }
    ]),
    w3cAccounts: custom.w3cAccounts
  };

  testDataCache[testDataId] = testData;
  return JSON.parse(JSON.stringify(testData));
}


/**
 * Stub that handles GraphQL requests without actually sending any GraphQL
 * request to GitHub.
 *
 * For query requests, the function returns suitable test data, depending on
 * the environment variable PROJECT_NUMBER.
 *
 * For mutation requests, the function returns an ok response without applying
 * any actual mutation.
 *
 * Function throws if the request cannot be handled.
 */
export async function sendGraphQLRequest(query, acceptHeader = '') {
  const PROJECT_NUMBER = await getEnvKey('PROJECT_NUMBER');
  const testData = await getTestData(PROJECT_NUMBER);

  if (query.startsWith('query')) {
    if (query.includes('projectV2(number: ')) {
      const match = query.match(/field\(name: "([^"]+)"\) {/);
      if (match) {
        const name = match[1];
        const field = {
          id: `id_field_${name}`,
          name
        };
        if (name === 'Room') {
          field.options = testData.rooms;
        }
        else if (name === 'Day') {
          field.options = testData.days;
        }
        else if (name === 'Slot') {
          field.options = testData.slots;
        }
        return {
          data: {
            organization: {
              projectV2: {
                id: testData.id,
                url: testData.url,
                title: testData.title,
                shortDescription: testData.shortDescription,
                field
              }
            }
          }
        };
      }
      else if (query.includes('items(')) {
        return {
          data: {
            organization: {
              projectV2: {
                items: {
                  nodes: testData.sessions
                }
              }
            }
          }
        };
      }
      else {
        throw new Error('Unexpected GraphQL projectV2 query request, cannot fake it!', { cause: query });
      }
    }
    else if (query.includes('user(login: ')) {
      const match = query.match(/user\(login: "([^"]+)"/);
      const login = match[1];
      let user = userCache.find(user => user.login === login);
      if (!user) {
        user = { login, databaseId: uid++ };
        userCache.push(user);
      }
      return {
        data: {
          user: {
            databaseId: user.databaseId,
            login
          }
        }
      };
    }
    else if (query.includes('repository(owner: ')) {
      return {
        data: {
          repository: {
            labels: {
              nodes: testData.labels
            }
          }
        }
      };
    }
    else {
      throw new Error('Unexpected GraphQL query request, cannot fake it!', { cause: query });
    }
  }
  else if (query.startsWith('mutation')) {
    throw new Error('TODO: return right ok message for GraphQL mutation request', { cause: query });
  }
  else {
    throw new Error('Unexpected GraphQL request, cannot fake it!', { cause: query });
  }
}


/**
 * Stub for the fetchW3CAccount function
 */
export async function fetchW3CAccount(databaseId) {
  const PROJECT_NUMBER = await getEnvKey('PROJECT_NUMBER');
  const testData = await getTestData(PROJECT_NUMBER);

  const user = userCache.find(user => user.databaseId === databaseId);
  if (!user) {
    throw new Error(`Unexpected databaseId requested: ${databaseId}`);
  }

  if (testData.w3cAccounts) {
    // The test data uses explicit mapping, let's use that
    const w3cAccount = testData.w3cAccounts[user.login];
    if (w3cAccount) {
      return {
        githubId: databaseId,
        w3cId: testData.w3cAccounts[user.login],
        name: user.login
      };
    }
    else {
      return null;
    }
  }
  else {
    // "Everyone is awesome" mode, pretend that all accounts can be linked to
    // a W3C account.
    return {
      githubId: databaseId,
      w3cId: databaseId,
      name: user.login
    };
  }
}

/**
 * Reset internal memory caches
 */
export async function resetCaches() {
  uid = 0;
  userCache = [];
  testDataCache = {};
}