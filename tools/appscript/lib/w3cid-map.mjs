import { getEnvKey } from '../../common/envkeys.mjs';

/**
 * Fetch private mapping information from the Google sheet
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
