import { getEnvKey } from '../../common/envkeys.mjs';
import wrappedFetch from '../../common/wrappedfetch.mjs';

/**
 * Fetch private mapping information from the Google sheet
 */
export async function fetchMapping() {
  const W3CID_SPREADSHEET = await getEnvKey('W3CID_SPREADSHEET');
  const spreadsheet = SpreadsheetApp.openById(W3CID_SPREADSHEET);

  const mapping = {};
  for (const sheet of spreadsheet.getSheets()) {
    const rows = sheet.getDataRange().getValues();
    for (const row of rows.slice(1)) {
      mapping[row[0]] = row[1];
    }
  }

  return mapping;
}

export async function exportMapping(project) {
  const repoparts = project.metadata.reponame.split('/');
    const repo = {
      owner: repoparts.length > 1 ? repoparts[0] : 'w3c',
      name: repoparts.length > 1 ? repoparts[1] : repoparts[0]
    };

    console.log('- read the mapping table');
    const w3cIds = await fetchMapping();

    console.log('- check whether the GitHub variable exists');
    const GRAPHQL_TOKEN = await getEnvKey('GRAPHQL_TOKEN');
    let res = await wrappedFetch(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/actions/variables/W3CID_MAP`,
      {
        method: 'GET',
        headers: {
          'Authorization': `bearer ${GRAPHQL_TOKEN}`,
          'Accept': 'application/vnd.github+json'
        }
      }
    );
    if (res.status === 200) {
      console.log('- variable already exists, update it');
      res = await wrappedFetch(
        `https://api.github.com/repos/${repo.owner}/${repo.name}/actions/variables/W3CID_MAP`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `bearer ${GRAPHQL_TOKEN}`,
            'Accept': 'application/vnd.github+json'
          },
          body: JSON.stringify({
            name: 'W3CID_MAP',
            value: JSON.stringify(w3cIds, null, 2)
          })
        }
      );
      if (res.status !== 204) {
        throw new Error(`GitHub REST API server returned an unexpected HTTP status ${res.status}`);
      }
    }
    else if (res.status === 404) {
      console.log('- variable does not exist yet, create it');
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
            name: 'W3CID_MAP',
            value: JSON.stringify(w3cIds, null, 2)
          })
        }
      );
      if (res.status !== 201) {
        throw new Error(`GitHub REST API server returned an unexpected HTTP status ${res.status}`);
      }
    }
    else {
      throw new Error(`GitHub REST API server returned an unexpected HTTP status ${res.status}`);
    }
}
