#!/usr/bin/env node
/**
 * This tool returns the right structure for the ROOM_ZOOM variable that stores
 * mappings between available rooms and Zoom coordinates. The structure then
 * needs to be updated with the right Zoom coordinates, and stored locally in
 * `config.json` or in the GitHub repository as a ROOM_ZOOM variable.
 *
 * To run the tool:
 *
 *  node tools/init-room-zoom.mjs
 *
 * Essentially, this tool should be run once when the annual repository is
 * created and the list of rooms known.
 */

import { getEnvKey } from './common/envkeys.mjs';
import { fetchProject } from './node/lib/project.mjs';

async function run() {
  const PROJECT_OWNER = await getEnvKey('PROJECT_OWNER', 'w3c');
  const PROJECT_NUMBER = await getEnvKey('PROJECT_NUMBER');
  const project = await fetchProject(PROJECT_OWNER, PROJECT_NUMBER);
  if (!project) {
    throw new Error(`Project ${PROJECT_OWNER}/${PROJECT_NUMBER} could not be retrieved`);
  }

  const rooms = {};
  for (const room of project.rooms) {
    rooms[room.label] = '@@';
  }
  console.log(JSON.stringify(rooms, null, 2));
}

run()
  .catch(err => {
    console.log(`Something went wrong: ${err.message}`);
    throw err;
  });