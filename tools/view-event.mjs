#!/usr/bin/env node
/**
 * This tool returns the event's data either as a JSON object that can be used
 * as test data or as an HTML page that lets one visualize the current schedule
 * along with information about sessions.
 *
 * The tool return an HTML page by default.
 *
 * To run the tool:
 *
 *  npx view-event
 *  npx view-event html > grid.html
 *  npx view-event json > event.json
 */

import { getEnvKey } from './lib/envkeys.mjs';
import { fetchProject, convertProjectToJSON } from './lib/project.mjs';
import { convertProjectToHTML } from './lib/project2html.mjs';

async function main(format) {
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

  if (format === 'json') {
    const data = convertToJSON(project);
    console.log(JSON.stringify(data, null, 2));
  }
  else {
    const html = await convertProjectToHTML(project);
    console.log(html);
  }
}

main(process.argv[2])
  .catch(err => {
    console.warn(`Something went wrong: ${err.message}`);
    throw err;
  });
