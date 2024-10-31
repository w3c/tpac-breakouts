import _createOnOpenTrigger from './create-onopen-trigger.mjs';
import _addTPACMenu from './add-custom-menu.mjs';
import _associateWithGitHubRepository from './link-to-repository.mjs';
import _importFromGitHub from './import-from-github.mjs';
import _generateGrid from './generate-grid.mjs';

function main() { _createOnOpenTrigger(); }
function addTPACMenu() { _addTPACMenu(); }
function associateWithGitHubRepository() { _associateWithGitHubRepository(); }
function importFromGitHub() { _importFromGitHub(); }
function generateGrid() { _generateGrid(); }
