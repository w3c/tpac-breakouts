/**
 * This module creates stubs for the functions that fetch data from the
 * network, replacing content with test data as appropriate. The stub functions
 * are only meant for testing purpose!
 */

import { getEnvKey } from '../tools/common/envkeys.mjs';
import defaultGroups from './data/w3cgroups.json' with { type: 'json' };

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
  testDataId = testDataId.replace(/^test\//, '');
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
    return arr.map(item => {
      if (typeof item === 'string') {
        return {
          id: `id_${uid++}`,
          name: item
        };
      }
      else {
        return Object.assign(item, {
          id: `id_${uid++}`
        });
      }
    });
  }

  function toGraphQLRoomList(arr) {
    return arr
      .map(item => {
        if (typeof item === 'string') {
          return { name: item };
        }
        return item;
      })
      .map(item => {
        const match = item.name.match(/^(.*?)(?:\s*\((\d+)\s*(?:\-\s*([^\)]+))?\))?(?:\s*\((vip)\))?$/i);
        item.label = item.label ?? match[1];
        item.location = item.location ?? match[3] ?? '';
        item.capacity = item.capacity ?? parseInt(match[2] ?? '30', 10);
        item.vip = !!item.vip || !!match[4];
        return item;
      });
  }

  function getWeekday(date) {
    try {
      return [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday',
        'Thursday', 'Friday', 'Saturday'
      ][(new Date(date)).getDay()];
    }
    catch {
      return 'Sunday';
    }
  }

  function toGraphQLSlotList(arr) {
    return arr
      .map(item => {
        if (typeof item === 'string') {
          const reSlot = /^(\d{4}-\d{2}-\d{2}) (\d+:\d+)\s*-\s*(\d+:\d+)$/;
          const match = item.match(reSlot);
          if (!match) {
            const reDateFallback = /^(.*?) (\d+:\d+)\s*-\s*(\d+:\d+)$/;
            const dateFallback = item.match(reDateFallback);
            if (dateFallback) {
              return {
                date: dateFallback[1],
                start: dateFallback[2],
                end: dateFallback[3]
              };
            }
            else {
              const reSlotFallback = /^(\d{4}-\d{2}-\d{2}) (.*)$/;
              const slotFallback = item.match(reSlotFallback);
              if (slotFallback) {
                return {
                  date: slotFallback[1],
                  start: slotFallback[2]
                };
              }
              else {
                return { date: item };
              }
            }
          }
          const slot = {
            date: match[1],
            start: match[2],
            end: match[3]
          };
          return slot;
        }
        return item;
      })
      .map(item => {
        const reTimes = /^(\d+):(\d+)$/;
        const startMatch = item.start?.match(reTimes);
        const endMatch = item.end?.match(reTimes);
        if (startMatch && endMatch) {
          item.duration =
            (parseInt(endMatch[1], 10) * 60 + parseInt(endMatch[2], 10)) -
            (parseInt(startMatch[1], 10) * 60 + parseInt(startMatch[2], 10));
        }
        item.weekday = getWeekday(item.date);
        return item;
      });
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
    return {
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
      author: toGraphQLAuthor(session.author ?? 'testbot'),
      room: session.room,
      day: session.day,
      slot: session.slot,
      meeting: session.meeting
    };
  };

  const testData = {
    id: `id_project_${testDataId}`,
    title: custom.title ?? testDataId,
    metadata: custom.metadata ?? {
      meeting: 'Breakouts Test Event',
      timezone: 'Etc/UTC',
      reponame: 'test/' + testDataId
    },
    rooms: toGraphQLRoomList(custom.rooms ?? ['Panic room (25)']),
    slots: toGraphQLSlotList(custom.slots ?? ['2042-04-07 9:00-10:00']),
    labels: toGraphQLNameList(custom.labels ?? ['session']),
    sessions: toGraphQLSessions(custom.sessions ?? [
      { number: 1, title: 'A test session' }
    ]),
    w3cAccounts: custom.w3cAccounts,
    w3cGroups: custom.w3cGroups ?? defaultGroups
  };
  if (custom.allowMultipleMeetings) {
    testData.allowMultipleMeetings = custom.allowMultipleMeetings;
  }

  testDataCache[testDataId] = testData;
  return JSON.parse(JSON.stringify(testData));
}


/**
 * Stub that handles GraphQL requests without actually sending any GraphQL
 * request to GitHub.
 *
 * For query requests, the function returns suitable test data, depending on
 * the environment variable REPOSITORY.
 *
 * For mutation requests, the function returns an ok response without applying
 * any actual mutation.
 *
 * Function throws if the request cannot be handled.
 */
export async function sendGraphQLRequest(query, acceptHeader = '') {
  const REPOSITORY = await getEnvKey('REPOSITORY');
  const testData = await getTestData(REPOSITORY);

  if (query.startsWith('query')) {
    if (query.includes('issues(states: OPEN,')) {
      return {
        data: {
          organization: {
            repository: {
              issues: {
                nodes: testData.sessions
              }
            }
          }
        }
      };
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
  const REPOSITORY = await getEnvKey('REPOSITORY');
  const testData = await getTestData(REPOSITORY);

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
 * Stub for the fetchW3CGroups function
 */
export async function fetchW3CGroups() {
  const REPOSITORY = await getEnvKey('REPOSITORY');
  const testData = await getTestData(REPOSITORY);
  return testData.w3cGroups ?? [];
}


/**
 * Stub for the importVariableFromGitHub function
 */
export async function importVariableFromGitHub(name) {
  const REPOSITORY = await getEnvKey('REPOSITORY');
  const testData = await getTestData(REPOSITORY);
  if (testData[name]) {
    return testData[name];
  }
  if (name === 'EVENT') {
    return testData.metadata;
  }
  else if (name === 'SCHEDULE') {
    return testData.sessions.map(session => [
      session.number,
      session.room,
      session.day,
      session.slot,
      session.meeting
    ]);
  }
  else if (name === 'VALIDATION') {
    const validation = [];
    for (const session of testData.sessions) {
      validation.push({
        number: session.number,
        error: session.validation?.error,
        warning: session.validation?.warning,
        check: session.validation?.check,
        note: session.validation?.note,
      });
    }
    return validation;
  }
  else if (testData[name.toLowerCase()]) {
    return testData[name.toLowerCase()];
  }
  else if (name === 'REGISTRANTS') {
    return null;
  }
  else {
    throw new Error(`No test data for ${name}`);
  }
}


/**
 * Stub for the exportVariableToGitHub function
 */
export async function exportVariableToGitHub(name, value) {
  return;
}

/**
 * Reset internal memory caches
 */
export async function resetCaches() {
  uid = 0;
  userCache = [];
  testDataCache = {};
}