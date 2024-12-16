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
      stubs = await import(`../../../test/stubs.mjs`);
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


/**
 * Normalize the names of the group
 *
 * Note that the EOWG is treated as a hardcoded exception to the rule
 * (that's the only group that ends with its acronym)
 */
function normalizeGroup(group) {
  group.name = group.name
    .replace(/\s+\(EOWG\)$/i, '')
    .replace(/\s+business group$/i, ' BG')
    .replace(/\s+community group$/i, ' CG')
    .replace(/\s+interest group$/i, ' IG')
    .replace(/\s+working group$/i, ' WG')
    .replace(/\s+task force$/i, ' TF');
  group.label = group.name;

  group.abbrName = group.name
    .replace(/\s+(bg|cg|ig|wg|tf)$/i, '')
    .toLowerCase();

  // Hardcode a few exceptions
  if (group.abbrName === 'technical architecture group') {
    group.alias = ['TAG'];
    group.label += ' (TAG)';
  }
  else if (group.abbrName === 'web platform incubator') {
    group.alias = ['WICG'];
    group.label += ' (WICG)';
  }
  else if (group.abbrName === 'cascading style sheets (css)') {
    group.abbrName = 'cascading style sheets';
    group.alias = ['CSS WG', 'Cascading Style Sheets WG'];
  }
  else if (group.abbrName === 'privacy') {
    group.alias = ['ping'];
    group.label += ' (PING)';
  }
  else if (group.abbrName === 'web real-time communications') {
    group.alias = ['WebRTC WG'];
  }

  return group;
}

/**
 * Return information about all known active W3C groups.
 */
export async function fetchW3CGroups() {
  // Only fetch groups once
  // (Note: we don't make a copy because that's super slow for the whole list)
  if (cache.w3cGroups) {
    return cache.w3cGroups;
  }

  // Use stub version when running tests
  // Note the function cannot be stubbed from an external perspective, due to
  // it being an ES6 module.
  const STUB_REQUESTS = await getEnvKey('STUB_REQUESTS', '');
  if (STUB_REQUESTS) {
    if (!stubs) {
      stubs = await import(`../../../test/stubs.mjs`);
    }
    const groups = await stubs.fetchW3CGroups();
    cache.w3cGroups = groups.map(normalizeGroup);
    return JSON.parse(JSON.stringify(cache.w3cGroups));
  }

  const groups = [];
  for (const groupType of ['bg', 'cg', 'ig', 'wg', 'other', 'tf']) {
    const res = await fetch(`https://api.w3.org/groups/${groupType}?embed=1&items=200`);
    if (res.status !== 200) {
      throw new Error(`W3C API server returned an unexpected HTTP status ${res.status}`);
    }
    const json = await res.json();

    if (json.limit < json.total) {
      throw new Error(`Too many W3C groups (${json.total}) to retrieve, adjust request or add paging support!`);
    }

    for (const group of json._embedded.groups) {
      const normalizedGroup = normalizeGroup({
        w3cId: group.id,
        name: group.name,
        type: groupType
      });
      groups.push(normalizedGroup);
    }
  }
  cache.w3cGroups = groups;
  return JSON.parse(JSON.stringify(cache.w3cGroups));
}


/**
 * Reset internal memory cache.
 *
 * The function should only be useful to reset state between tests.
 */
export async function resetW3CCache() {
  cache = {};

  const STUB_REQUESTS = await getEnvKey('STUB_REQUESTS', '');
  if (STUB_REQUESTS) {
    if (!stubs) {
      stubs = await import(`../../../test/stubs.mjs`);
    }
    stubs.resetCaches();
  }
}
