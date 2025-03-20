import { getEnvKey } from './envkeys.mjs';
import wrappedFetch from './wrappedfetch.mjs';

/**
 * Generic function to export a variable to the project's GitHub repository
 * as a GitHub actions variable. The function updates the variable if it
 * already exists. It creates the variable otherwise.
 */
export async function exportVariableToGitHub(repository, name, value) {
  const repoparts = repository.split('/');
  const repo = {
    owner: repoparts.length > 1 ? repoparts[0] : 'w3c',
    name: repoparts.length > 1 ? repoparts[1] : repoparts[0]
  };

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
