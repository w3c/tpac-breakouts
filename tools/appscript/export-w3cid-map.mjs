import reportError from './lib/report-error.mjs';
import { getProject } from './lib/project.mjs';
import { fetchMapping } from './lib/w3cid-map.mjs';
import { getEnvKey } from '../common/envkeys.mjs';
import wrappedFetch from '../common/wrappedfetch.mjs';

export default async function () {
  try {
    console.log('Read data from spreadsheet...');
    const project = getProject(SpreadsheetApp.getActiveSpreadsheet());
    console.log('Read data from spreadsheet... done');

    console.log('Read the mapping table...');
    const w3cIds = await fetchMapping();
    console.log('Read the mapping table... done');

    if (!project.metadata.reponame) {
      reportError(`No GitHub repository associated with the current document.

  Make sure that the "GitHub repository name" parameter is set in the "Event" sheet.

  Also make sure the targeted repository and project have been properly initialized.
  If not, ask François or Ian to run the required initialization steps.`);
      return;
    }

    const repoparts = project.metadata.reponame.split('/');
    const repo = {
      owner: repoparts.length > 1 ? repoparts[0] : 'w3c',
      name: repoparts.length > 1 ? repoparts[1] : repoparts[0]
    };

    console.log('Push the mapping table to the GitHub repository...');
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
    console.log('Push the mapping table to the GitHub repository... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}