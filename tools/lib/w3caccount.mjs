import { getEnvKey } from './envkeys.mjs';

/**
 * Internal memory cache to avoid sending the same request more than once
 * (same author may be associated with multiple sessions!)
 */
const cache = {};


/**
 * In test mode, use a stub. Note an ES6 module cannot be stubbed directly
 * because "import" statements make things immutable, so the module itself
 * needs to have "test code".
 */
let stubs = null;


/**
 * Return the W3C account linked to the requested person, identified by their
 * GitHub identity.
 *
 * Note: the function takes a `databaseId` identifier (returned by GitHub)
 * because users may update their `login` on GitHub at any time.
 */
export async function fetchW3CAccount(databaseId) {
  // Only fetch accounts once
  if (cache[databaseId]) {
    return Object.assign({}, cache[databaseId]);
  }

  // Use stub version when running tests
  // Note the function cannot be stubbed from an external perspective, due to
  // it being an ES6 module.
  const STUB_REQUESTS = await getEnvKey('STUB_REQUESTS', '');
  if (STUB_REQUESTS) {
    if (!stubs) {
      stubs = await import(`../../test/stubs.mjs`);
    }
    cache[databaseId] = await stubs.fetchW3CAccount(databaseId);
    return cache[databaseId];
  }

  const res = await fetch(
    `https://api.w3.org/users/connected/github/${databaseId}`
  );

  if (res.status !== 200) {
    if (res.status >= 500) {
      throw new Error(`W3C API server error, ${res.status} status received`);
    }
    if (res.status === 404) {
      return null;
    }
    throw new Error(`W3C API server returned an unexpected HTTP status ${res.status}`);
  }

  const json = await res.json();
  const user = {
    githubId: databaseId,
    w3cId: json.id,
    name: json.name,
    email: json.email
  };
  cache[databaseId] = user;
  return user;
}
