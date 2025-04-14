import { getEnvKey } from './envkeys.mjs';
import { parseRepositoryName } from './repository.mjs';
import wrappedFetch from './wrappedfetch.mjs';


/**
 * In test mode, use a stub. Note an ES6 module cannot be stubbed directly
 * because "import" statements make things immutable, so the module itself
 * needs to have "test code".
 */
let stubs = null;


/**
 * Generic function to import a variable from the project's GitHub repository.
 */
export async function importVariableFromGitHub(reponame, name) {
  // Use stub version when running tests
  // Note the function cannot be stubbed from an external perspective, due to
  // it being an ES6 module.
  const STUB_REQUESTS = await getEnvKey('STUB_REQUESTS', '');
  if (STUB_REQUESTS) {
    if (!stubs) {
      stubs = await import(`../../test/stubs.mjs`);
    }
    return stubs.importVariableFromGitHub(name);
  }

  const repo = parseRepositoryName(reponame);
  const GRAPHQL_TOKEN = await getEnvKey('GRAPHQL_TOKEN');
  let res = await wrappedFetch(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/actions/variables/${name}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${GRAPHQL_TOKEN}`,
        'Accept': 'application/vnd.github+json'
      }
    }
  );
  if (res.status === 200) {
    const json = await res.json();
    return JSON.parse(json.value);
  }
  else if (res.status === 404) {
    return null;
  }
  else {
    throw new Error(`GitHub REST API server returned an unexpected HTTP status ${res.status} for GET request on variable ${name}`);
  }
}


/**
 * Generic function to export a variable to the project's GitHub repository
 * as a GitHub actions variable. The function updates the variable if it
 * already exists. It creates the variable otherwise.
 */
export async function exportVariableToGitHub(reponame, name, value) {
  // Use stub version when running tests
  // Note the function cannot be stubbed from an external perspective, due to
  // it being an ES6 module.
  const STUB_REQUESTS = await getEnvKey('STUB_REQUESTS', '');
  if (STUB_REQUESTS) {
    if (!stubs) {
      stubs = await import(`../../test/stubs.mjs`);
    }
    return stubs.exportVariableToGitHub(name, value);
  }

  const repo = parseRepositoryName(reponame);
  const valueStr = JSON.stringify(value, null, 2);

  console.log(`- check whether the ${name} variable exists`);
  const GRAPHQL_TOKEN = await getEnvKey('GRAPHQL_TOKEN');
  let res = await wrappedFetch(
    `https://api.github.com/repos/${repo.owner}/${repo.name}/actions/variables/${name}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `bearer ${GRAPHQL_TOKEN}`,
        'Accept': 'application/vnd.github+json'
      }
    }
  );
  if (res.status === 200) {
    const json = await res.json();
    if (json.value === valueStr) {
      console.log(`- the ${name} variable is already up-to-date`);
      return;
    }
    console.log(`- the ${name} variable already exists, update it`);
    res = await wrappedFetch(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/actions/variables/${name}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `bearer ${GRAPHQL_TOKEN}`,
          'Accept': 'application/vnd.github+json'
        },
        body: JSON.stringify({
          name,
          value: valueStr
        })
      }
    );
    if (res.status !== 204) {
      throw new Error(`GitHub REST API server returned an unexpected HTTP status ${res.status} for PATCH request on variable ${name}`);
    }
  }
  else if (res.status === 404) {
    console.log(`- the ${name} variable does not exist yet, create it`);
    res = await wrappedFetch(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/actions/variables`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `bearer ${GRAPHQL_TOKEN}`,
          'Accept': 'application/vnd.github+json'
        },
        body: JSON.stringify({
          name: name,
          value: valueStr
        })
      }
    );
    if (res.status !== 201) {
      throw new Error(`GitHub REST API server returned an unexpected HTTP status ${res.status} for POST request on variable ${name}`);
    }
  }
  else {
    throw new Error(`GitHub REST API server returned an unexpected HTTP status ${res.status} for GET request on variable ${name}`);
  }
}
