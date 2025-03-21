import { getEnvKey } from '../../common/envkeys.mjs';
import { exportVariableToGitHub } from '../../common/export-variable.mjs';

/**
 * Fetch private chairs/groups mapping information from the dedicated Google
 * spreadsheet.
 */
export async function fetchMapping() {
  const W3CID_SPREADSHEET = await getEnvKey('W3CID_SPREADSHEET');
  const spreadsheet = SpreadsheetApp.openById(W3CID_SPREADSHEET);

  const mapping = {};
  for (const sheet of spreadsheet.getSheets()) {
    const rows = sheet.getDataRange().getValues();
    for (const row of rows.slice(1)) {
      mapping[row[0]] = row[1];
    }
  }

  return mapping;
}

/**
 * Export the private chairs/groups mapping information to GitHub.
 */
export async function exportMapping(project) {
  console.log('- read the mapping table');
  const w3cIds = await fetchMapping();
  return exportVariableToGitHub(project.metadata.reponame, 'W3CID_MAP', w3cIds);
}
