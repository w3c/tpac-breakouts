#!/usr/bin/env node
/**
 * This tool returns an HTML page that lets one visualize the current schedule
 * along with a few other information about sessions.
 *
 * To run the tool and save the resulting page to a `grid.html` file:
 *
 *  npx view-grid > grid.html
 */

import { getEnvKey } from './lib/envkeys.mjs';
import { fetchProject } from './lib/project.mjs';
import { convertProjectToHTML } from './lib/project2html.mjs';


async function main() {
  const PROJECT_OWNER = await getEnvKey('PROJECT_OWNER');
  const PROJECT_NUMBER = await getEnvKey('PROJECT_NUMBER');
  const CHAIR_W3CID = await getEnvKey('CHAIR_W3CID', {}, true);
  console.warn();
  console.warn(`Retrieve project ${PROJECT_OWNER}/${PROJECT_NUMBER}...`);
  const project = await fetchProject(PROJECT_OWNER, PROJECT_NUMBER);
  if (!project) {
    throw new Error(`Project ${PROJECT_OWNER}/${PROJECT_NUMBER} could not be retrieved`);
  }
  project.chairsToW3CID = CHAIR_W3CID;
  console.warn(`- found ${project.sessions.length} sessions`);

  const html = await convertProjectToHTML(project);
  console.log(html);
}

main()
  .catch(err => {
    console.warn(`Something went wrong: ${err.message}`);
    throw err;
  });
