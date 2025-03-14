/**
 * The `add-custom-menu.mjs` script creates the custom menu in the spreadsheet.
 * Entries in the custom menu trigger a call to a JavaScript function, but that
 * association is done through a string.
 *
 * This file forces the exposition of these menu functions as global functions.
 * That is needed because the rollup bundler does not know anything about
 * the AppScript environment, and does not understand the association between
 * the custom menu and the functions.
 *
 * Bundle generation with Rollup must also run with the `--no-treeshake` option
 * for the same reason: Rollup would simply drop all code and generate an empty
 * bundle otherwise (precisely because, as far as it can tell, nothing calls
 * these global functions).
 */

import _createOnOpenTrigger from './create-onopen-trigger.mjs';
import _addTPACMenu from './add-custom-menu.mjs';
import _generateGrid from './generate-grid.mjs';
import _validateGrid from './validate-grid.mjs';
import _proposeGrid from './propose-grid.mjs';
import _exportGrid from './export-grid.mjs';
import _importGrid from './import-grid.mjs';
import _importSessions from './import-sessions.mjs';
import _importMetadata from './import-metadata.mjs';
import _exportMetadata from './export-metadata.mjs';
import _exportEventToFiles from './export-event-to-files.mjs';

function main() { _createOnOpenTrigger(); }
function addTPACMenu() { _addTPACMenu(); }
function generateGrid() { _generateGrid(); }
function validateGrid() { _validateGrid(); }
function proposeGrid() { _proposeGrid(); }
function exportGrid() { _exportGrid(); }
function importGrid() { _importGrid(); }
function importSessions() { _importSessions(); }
function importMetadata() { _importMetadata(); }
function exportMetadata() { _exportMetadata(); }
function exportEventToFiles() { _exportEventToFiles(); }
