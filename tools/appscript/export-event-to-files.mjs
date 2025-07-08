import { getProject } from './lib/project.mjs';
import reportError from './lib/report-error.mjs';
import { fetchMapping } from './lib/w3cid-map.mjs';
import {
  convertProjectToHTML,
  convertProjectToRegistrationHTML } from '../common/project2html.mjs';


export default function () {
  return exportEventToFiles(SpreadsheetApp.getActiveSpreadsheet());
}


async function exportEventToFiles(spreadsheet) {
  try {
    console.log('Read data from spreadsheet...');
    const project = getProject(spreadsheet);
    project.w3cIds = await fetchMapping();
    if (!project.sheets.sessions.sheet) {
      reportError('No sheet found that contains the list of sessions, please import data from GitHub first.');
      return;
    }
    console.log('Read data from spreadsheet... done');

    console.log('Convert to HTML...');
    const options = {
      reduce: project.metadata.rooms === 'hide'
    };
    const html = await convertProjectToHTML(project, options);
    console.log('Convert to HTML... done');

    console.log('Convert to registration table...');
    const registrationHtml = await convertProjectToRegistrationHTML(project);
    console.log('Convert to registration table... done');

    console.log('Create data URL for the HTML export...');
    const htmlBase64 = Utilities.base64Encode(html, Utilities.Charset.UTF_8);
    const htmlDataUrl = `data:text/html;charset=UTF8;base64,${htmlBase64}`;
    console.log('Create data URL for the HTML export... done');

    console.log('Create data URL for the registration table...');
    const registrationBase64 = Utilities.base64Encode(registrationHtml, Utilities.Charset.UTF_8);
    const registrationDataUrl = `data:text/html;charset=UTF8;base64,${registrationBase64}`;
    console.log('Create data URL for the registration table... done');

    console.log('Create data URL for the JSON export...');
    const jsonBase64 = Utilities.base64Encode(
      JSON.stringify(project, null, 2),
      Utilities.Charset.UTF_8);
    const jsonDataUrl = `data:application/json;charset=UTF8;base64,${jsonBase64}`;
    console.log('Create data URL for the JSON export... done');

    console.log('Report result...');
    const htmlOutput = HtmlService
      .createHtmlOutput(`<p>
          Event data files prepared.
          Click following link(s) to download them:
        </p>
        <ul>
          <li>
            <a href="${htmlDataUrl}" download="event.html">
              Event schedule (HTML file)
            </a>
          </li>
          <li>
            <a href="${registrationDataUrl}" download="registration.html">
              Registration form view (HTML file)
            </a>
          </li>
          <li>
            <a href="${jsonDataUrl}" download="event.json">
              Event data (JSON file)
            </a>
          </li>
        </ul>
    `)
      .setWidth(300)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Export event to a file');
    console.log('Report result... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}
