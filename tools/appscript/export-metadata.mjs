import reportError from './lib/report-error.mjs';
import {
  getProject,
  syncProjectMetadataWithGitHub
} from './lib/project.mjs';
import {
  fetchProjectFromGitHub,
  exportProjectMetadata,
  serializeProjectMetadata
} from '../common/project.mjs';
import { exportMapping } from './lib/w3cid-map.mjs';
import { exportRoomZoom } from './lib/room-zoom.mjs';


export default async function () {
  try {
    console.log('Read data from spreadsheet...');
    const project = getProject(SpreadsheetApp.getActiveSpreadsheet());
    console.log('Read data from spreadsheet... done');

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

    console.log('Fetch data from GitHub...');
    const githubProject = await fetchProjectFromGitHub(
      repo.owner === 'w3c' ? repo.owner : `user/${repo.owner}`,
      repo.name,
      null
    );
    console.log('Fetch data from GitHub... done');

    console.log('Export metadata to GitHub...');
    await syncProjectMetadataWithGitHub(project, githubProject);
    console.log('Export metadata to GitHub... done');

    console.log('Push the mapping table to the GitHub repository...');
    await exportMapping(project);
    console.log('Push the mapping table to the GitHub repository... done');

    console.log('Export ROOM_ZOOM variable to GitHub...');
    await exportRoomZoom(project);
    console.log('Export ROOM_ZOOM variable to GitHub... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}