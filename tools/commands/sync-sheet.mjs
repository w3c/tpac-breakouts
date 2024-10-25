import { getEnvKey } from '../lib/envkeys.mjs';
import { convertProjectToSheet } from '../lib/project2sheet.mjs';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms, 'slept'));
}

export default async function (project, options) {
  console.warn(`Retrieve environment variables...`);
  const GOOGLE_KEY_FILE = await getEnvKey('GOOGLE_KEY_FILE');
  console.warn(`- GOOGLE_KEY_FILE: ${GOOGLE_KEY_FILE}`);
  const GOOGLE_SHEET_ID = await getEnvKey('GOOGLE_SHEET_ID', '');
  console.warn(`- GOOGLE_SHEET_ID: ${GOOGLE_SHEET_ID ?? 'not set'}`);
  const GOOGLE_SHARED_DRIVE_ID = await getEnvKey('GOOGLE_SHARED_DRIVE_ID', '');
  const W3C_LOGIN = await getEnvKey('W3C_LOGIN', '');
  console.warn(`- W3C_LOGIN: ${W3C_LOGIN ?? 'not set'}`);
  console.warn(`- GOOGLE_SHARED_DRIVE_ID: ${GOOGLE_SHARED_DRIVE_ID ?? 'not set'}`);
  console.warn(`Retrieve environment variables... done`);

  console.warn();
  console.warn(`Create/Update Google sheet...`);
  const sheetId = options?.sheet && options.sheet !== 'new' ?
    options.sheet :
    GOOGLE_SHEET_ID;
  const driveId = options?.drive ?
    options.drive :
    GOOGLE_SHARED_DRIVE_ID;
  const editorEmail = W3C_LOGIN ? W3C_LOGIN + '@w3.org' : '';
  await convertProjectToSheet(project, {
    spreadsheetId: sheetId,
    driveId,
    editorEmail,
    keyFile: GOOGLE_KEY_FILE
  });
  console.warn(`Create/Update Google sheet... done`);
}