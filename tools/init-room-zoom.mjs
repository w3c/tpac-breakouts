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
import { loadProject } from './node/lib/project.mjs';

async function run() {
  const project = await loadProject();
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