import { getEnvKey } from '../../common/envkeys.mjs';
import wrappedFetch from '../../common/wrappedfetch.mjs';

export async function exportRoomZoom(project) {
  const repoparts = project.metadata.reponame.split('/');
    const repo = {
      owner: repoparts.length > 1 ? repoparts[0] : 'w3c',
      name: repoparts.length > 1 ? repoparts[1] : repoparts[0]
    };

    const ROOM_ZOOM = {};
    for (const room of project.rooms) {
      if (room['Zoom link']) {
        ROOM_ZOOM[room.name] = {
          id: room['Zoom ID'],
          passcode: room['Zoom passcode'],
          link: room['Zoom link']
        };
      }
    }

    console.log('- check whether the GitHub variable exists');
    const GRAPHQL_TOKEN = await getEnvKey('GRAPHQL_TOKEN');
    let res = await wrappedFetch(
      `https://api.github.com/repos/${repo.owner}/${repo.name}/actions/variables/ROOM_ZOOM`,
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
        `https://api.github.com/repos/${repo.owner}/${repo.name}/actions/variables/ROOM_ZOOM`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `bearer ${GRAPHQL_TOKEN}`,
            'Accept': 'application/vnd.github+json'
          },
          body: JSON.stringify({
            name: 'ROOM_ZOOM',
            value: JSON.stringify(ROOM_ZOOM, null, 2)
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
            name: 'ROOM_ZOOM',
            value: JSON.stringify(ROOM_ZOOM, null, 2)
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
