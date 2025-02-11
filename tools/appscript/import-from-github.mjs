import { getProject } from './project.mjs';
import reportError from './report-error.mjs';
import { fetchProjectFromGitHub } from '../common/project.mjs';
import { refreshProject } from './project.mjs';
import * as YAML from '../../node_modules/yaml/browser/index.js';

/**
 * Trigger a GitHub workflow that refreshes the data from GitHub
 */
export default async function () {
  const project = getProject(SpreadsheetApp.getActiveSpreadsheet());

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

  let githubProject;
  try {
    const yamlTemplateResponse = UrlFetchApp.fetch(
      `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/refs/heads/main/.github/ISSUE_TEMPLATE/session.yml`
    );
    const yamlTemplate = yamlTemplateResponse.getContentText();
    const template = YAML.parse(yamlTemplate);

    githubProject = await fetchProjectFromGitHub(
      repo.owner === 'w3c' ? repo.owner : `user/${repo.owner}`,
      repo.name,
      template
    );
  }
  catch (err) {
    reportError(err.toString());
    return;
  }

  try {
    refreshProject(SpreadsheetApp.getActiveSpreadsheet(), githubProject, {
      what: 'all'
    });
  }
  catch(err) {
    reportError(err.toString());
    return;
  }

  const htmlOutput = HtmlService
    .createHtmlOutput(
      '<pre>' + JSON.stringify(githubProject, null, 2) + '</pre>'
    )
    .setWidth(300)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'GitHub project');
}