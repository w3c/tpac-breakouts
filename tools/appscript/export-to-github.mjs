import { getProject } from './project.mjs';
import reportError from './report-error.mjs';

/**
 * Trigger a GitHub workflow that refreshes the data from GitHub
 */
export default function () {
  const project = getProject(SpreadsheetApp.getActiveSpreadsheet());

  if (!project.metadata.reponame) {
    reportError(`No GitHub repository associated with the current document.

Make sure that the "GitHub repository name" parameter is set in the "Event" sheet.

Also make sure the targeted repository and project have been properly initialized.
If not, ask François or Ian to run the required initialization steps.`);
  }

  const repoparts = project.metadata.reponame.split('/');
  const repo = {
    owner: repoparts.length > 1 ? repoparts[0] : 'w3c',
    name: repoparts.length > 1 ? repoparts[1] : repoparts[0]
  };
  
}