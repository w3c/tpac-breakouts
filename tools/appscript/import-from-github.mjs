import { getProject } from './project.mjs';
import reportError from './report-error.mjs';
import { fetchProjectFromGitHub } from '../common/project.mjs';
import { refreshProject } from './project.mjs';
import * as YAML from '../../node_modules/yaml/browser/index.js';

/**
 * Trigger a GitHub workflow that refreshes the data from GitHub
 */
export default async function () {
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

  try {
    console.log('Fetch session template from GitHub...');
    const yamlTemplateResponse = UrlFetchApp.fetch(
      `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/refs/heads/main/.github/ISSUE_TEMPLATE/session.yml`
    );
    const yamlTemplate = yamlTemplateResponse.getContentText();
    const template = YAML.parse(yamlTemplate);
    console.log('Fetch session template from GitHub... done');

    console.log('Fetch data from GitHub...');
    const githubProject = await fetchProjectFromGitHub(
      repo.owner === 'w3c' ? repo.owner : `user/${repo.owner}`,
      repo.name,
      template
    );
    console.log('Fetch data from GitHub... done');

    console.log('Refresh spreadsheet data...');
    refreshProject(SpreadsheetApp.getActiveSpreadsheet(), githubProject, {
      what: 'all'
    });
    console.log('Refresh spreadsheet data... done');

    console.log('Report result...');
    const htmlOutput = HtmlService
      .createHtmlOutput(`
        <p>Spreadsheet updated with data from GitHub:</p>
        <ul>
          <li><b>${githubProject.rooms.length}</b> rooms</li>
          <li><b>${githubProject.days.length}</b> days</li>
          <li><b>${githubProject.slots.length}</b> slots</li>
          <li><b>${githubProject.sessions.length}</b> sessions</li>
        </ul>
      `)
      .setWidth(300)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Data exported');
    console.log('Report result... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}