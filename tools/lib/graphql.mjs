import { getEnvKey } from './envkeys.mjs';

/**
 * Internal memory cache to avoid sending the same request more than once
 * (same author may be associated with multiple sessions!)
 */
let cache = {};

/**
 * In test mode, use a stub. Note an ES6 module cannot be stubbed directly
 * because "import" statements make things immutable, so the module itself
 * needs to have "test code".
 */
let stubs = null;


/**
 * Reset internal memory cache.
 *
 * The function should only be useful to reset state between tests.
 */
export async function resetGraphQLCache() {
  cache = {};

  const STUB_REQUESTS = await getEnvKey('STUB_REQUESTS', '');
  if (STUB_REQUESTS) {
    if (!stubs) {
      stubs = await import(`../../test/stubs.mjs`);
    }
    stubs.resetCaches();
  }
}


/**
 * Wrapper function to send an GraphQL request to the GitHub GraphQL endpoint,
 * authenticating using either a token read from the environment (typically
 * useful when code is run within a GitHub job) or from a `config.json` file in
 * the root folder of the repository (typically useful for local runs).
 *
 * Function throws if the personal access token is missing.
 */
export async function sendGraphQLRequest(query, acceptHeader = '') {
  if (cache[query]) {
    return JSON.parse(JSON.stringify(cache[query]));
  }

  // Use stub version when running tests
  // Note the function cannot be stubbed from an external perspective, due to
  // it being an ES6 module.
  const STUB_REQUESTS = await getEnvKey('STUB_REQUESTS', '');
  if (STUB_REQUESTS) {
    if (!stubs) {
      stubs = await import(`../../test/stubs.mjs`);
    }
    cache[query] = await stubs.sendGraphQLRequest(query);
    return JSON.parse(JSON.stringify(cache[query]));
  }

  const GRAPHQL_TOKEN = await getEnvKey('GRAPHQL_TOKEN');
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `bearer ${GRAPHQL_TOKEN}`,
      'Accept': acceptHeader ?? undefined
    },
    body: JSON.stringify({ query }, null, 2)
  });
  if (res.status !== 200) {
    if (res.status >= 500) {
      throw new Error(`GraphQL server error, ${res.status} status received`);
    }
    if (res.status === 403) {
      throw new Error(`GraphQL server reports that the API key is invalid, ${res.status} status received`);
    }
    throw new Error(`GraphQL server returned an unexpected HTTP status ${res.status}`);
  }
  cache[query] = await res.json();
  return JSON.parse(JSON.stringify(cache[query]));
}
