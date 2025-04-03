import reportError from './lib/report-error.mjs';
import { getProject } from './lib/project.mjs';
import { exportMapping } from './lib/w3cid-map.mjs';
import { exportProjectToGitHub } from '../common/project.mjs';
import { createRepository } from '../common/repository.mjs';


export default async function () {
  try {
    console.log('Read data from spreadsheet...');
    const project = getProject(SpreadsheetApp.getActiveSpreadsheet());
    console.log('Read data from spreadsheet... done');

    if (!project.metadata.reponame) {
      reportError(`Happy to oblige, but I need a repository name!

  Make sure that the "GitHub repository name" parameter is set in the "Event" sheet.`);
      return;
    }

    // TODO: ask for confirmation

    console.log('Create GitHub repository...');
    const repo = await createRepository(project);
    console.log('Create GitHub repository... done');

    console.log('Export project to GitHub...');
    await exportProjectToGitHub(project, { what: 'all' });
    console.log('Export project to GitHub... done');

    console.log('Export W3CID_MAP mapping...');
    await exportMapping(project);
    console.log('Export W3CID_MAP mapping... done');

    console.log('Report result...');
    const repoUrl = `https://github.com/${repo.owner}/${repo.name}`;
    if (repo.ownerId) {
      const htmlOutput = HtmlService
        .createHtmlOutput(`
          <p>The
          <a href="${repoUrl}">${repo.owner}/${repo.name}</a>
          repository was created and initialized.</p>
          <p>Manual steps are still needed. Please run the following actions
          (in any order):</p>
          <ul>
            <li>In the <a href="${repoUrl}/settings/access">repo settings</a>,
            give write access to
            <a href="https://github.com/tpac-breakout-bot">@tpac-breakout-bot</a>.
            </li>
            <li>Set "watch" to "All Activity" for the repository to receive
            comments left on issues (look for the dropdown menu named "Watch"
            or "Unwatch" on the <a href="${repoUrl}">repo page</a>).</li>
            <li>Ask François (fd@w3.org) to set the <code>GRAPHQL_TOKEN</code>
            and <code>W3C_PASSWORD</code>
            <a href="${repoUrl}/settings/secrets/actions">repository secrets</a>.
            </li>
          </ul>

          <p>You may also want to add documentation to the repository:</p>
          <ul>
            <li><a href="${repoUrl}/wiki">Wiki pages<a/>, e.g., taking
            inspiration from
            <a href="https://github.com/w3c/tpac2024-breakouts/wiki">TPAC 2024
            breakouts Wiki pages</a>.</li>
            <li><a href="${repoUrl}/blob/main/README.md">README.md, e.g.,
            taking inspiration from the
            <a href="https://github.com/w3c/tpac2024-breakouts/blob/main/README.md">TPAC
            2024 README</a>.</li>
          </ul>`)
        .setWidth(400)
        .setHeight(400);
      SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'GitHub repository created');
    }
    else {
      const htmlOutput = HtmlService
        .createHtmlOutput(`
          <p><b>Nothing done!</b> As far as I can tell, the
          <a href="https://github.com/${repo.owner}/${repo.name}">${repo.owner}/${repo.name}</a>
          repository already exists.</p>`)
        .setWidth(400)
        .setHeight(400);
      SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'GitHub repository already exists');
    }
    console.log('Report result... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}