import _createOnOpenTrigger from './create-onopen-trigger.mjs';
import _addTPACMenu from './add-custom-menu.mjs';
import _generateGrid from './generate-grid.mjs';
import _validateGrid from './validate-grid.mjs';
import _exportGrid from './export-grid.mjs';
import _importGrid from './import-grid.mjs';
import _importSessions from './import-sessions.mjs';
import _importMetadata from './import-metadata.mjs';
import _exportMetadata from './export-metadata.mjs';
import _exportEventData from './export-event-data.mjs';

function main() { _createOnOpenTrigger(); }
function addTPACMenu() { _addTPACMenu(); }
function generateGrid() { _generateGrid(); }
function validateGrid() { _validateGrid(); }
function exportGrid() { _exportGrid(); }
function importGrid() { _importGrid(); }
function importSessions() { _importSessions(); }
function importMetadata() { _importMetadata(); }
function exportMetadata() { _exportMetadata(); }
function exportEventData() { _exportEventData(); }
