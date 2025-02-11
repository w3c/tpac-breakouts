import _createOnOpenTrigger from './create-onopen-trigger.mjs';
import _addTPACMenu from './add-custom-menu.mjs';
import _importFromGitHub from './import-from-github.mjs';
import _exportToGitHub from './export-to-github.mjs';
import _generateGrid from './generate-grid.mjs';
import _validateGrid from './validate-grid.mjs';
import _exportEventData from './export-event-data.mjs';

function main() { _createOnOpenTrigger(); }
function addTPACMenu() { _addTPACMenu(); }
function importFromGitHub() { _importFromGitHub(); }
function exportToGitHub() { _exportToGitHub(); }
function generateGrid() { _generateGrid(); }
function validateGrid() { _validateGrid(); }
function exportEventData() { _exportEventData(); }
