import { getEnvKey } from './envkeys.mjs';

/**
 * Internal memory cache to avoid sending the same request more than once
 * (same author may be associated with multiple sessions!)
 */
const cache = {};


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
    return Object.assign({}, cache[query]);
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
  return cache[query];
}
