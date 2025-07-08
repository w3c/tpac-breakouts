import { getProject } from './project.mjs';
import reportError from './report-error.mjs';
import { parseRepositoryName } from '../../common/repository.mjs';
import { fetchProjectFromGitHub } from '../../common/project.mjs';
import { fetchRegistrants } from '../../common/registrants.mjs';
import { validateGrid } from '../../common/validate.mjs';
import { refreshProject } from './project.mjs';
import { fetchMapping } from './w3cid-map.mjs';
import * as YAML from '../../../node_modules/yaml/browser/index.js';

/**
 * Trigger a GitHub workflow that refreshes the data from GitHub
 */
export default async function (type) {
  console.log('Read data from spreadsheet...');
  const project = getProject(SpreadsheetApp.getActiveSpreadsheet());
  project.w3cIds = await fetchMapping();
  console.log('Read data from spreadsheet... done');

  if (!project.metadata.reponame) {
    reportError(`No GitHub repository associated with the current document.

Make sure that the "GitHub repository name" parameter is set in the "Event" sheet.

Also make sure the targeted repository and project have been properly initialized.
If not, ask François or Ian to run the required initialization steps.`);
    return;
  }

  const reponame = project.metadata.reponame;
  const repo = parseRepositoryName(reponame);

  let template = null;
  if (type === 'all' || type === 'metadata') {
    console.log('Fetch session template from GitHub...');
    const yamlTemplateResponse = UrlFetchApp.fetch(
      `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/refs/heads/main/.github/ISSUE_TEMPLATE/session.yml`
    );
    const yamlTemplate = yamlTemplateResponse.getContentText();
    template = YAML.parse(yamlTemplate);
    console.log('Fetch session template from GitHub... done');
  }

  console.log('Fetch data from GitHub...');
  const githubProject = await fetchProjectFromGitHub(reponame, template);
  if (type === 'sessions') {
    // Make sure that we don't override schedule information that we already
    // have in the spreadsheet. We only want to update schedule information
    // of sessions that got added or removed.
    for (const ghSession of githubProject.sessions) {
      const session = project.sessions.find(s => s.number === ghSession.number);
      if (session) {
        ghSession.room = session.room;
        ghSession.slot = session.slot;
        ghSession.meeting = session.meeting;
        ghSession.meetings = session.meetings;
        ghSession.validation.error = null;
        ghSession.validation.warning = null;
        ghSession.validation.check = null;
      }
    }
  }
  project.sessions = githubProject.sessions;
  console.log('Fetch data from GitHub... done');

  if (project.metadata.type === 'groups') {
    console.log('Fetch registrants...');
    await fetchRegistrants(project);
    console.log('Fetch registrants... done');
  }

  console.log('Validate the grid...');
  const res = await validateGrid(project, { what: 'everything' });
  for (const change of res.changes) {
    console.warn(`- save changes for session ${change.number}`);
    const session = project.sessions.find(s => s.number === change.number);
    session.validation.error = change.validation.error;
    session.validation.warning = change.validation.warning;
    session.validation.check = change.validation.check;
  }
  console.log('Validate the grid... done');

  console.log('Refresh spreadsheet data...');
  refreshProject(
    SpreadsheetApp.getActiveSpreadsheet(),
    githubProject,
    { what: type }
  );
  console.log('Refresh spreadsheet data... done');

  return githubProject;
}