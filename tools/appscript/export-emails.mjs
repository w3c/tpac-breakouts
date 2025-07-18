import { getProject } from './lib/project.mjs';
import reportError from './lib/report-error.mjs';

export default async function () {
  try {
    console.log('Read data from spreadsheet...');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const project = getProject(spreadsheet);
    console.log('Read data from spreadsheet... done');

    if (project.metadata.type !== 'groups') {
      reportError(`I can only export emails for TPAC group meetings events".`);
      return;
    }

    const people = project.sessions
      .flatMap(session => session.people ?? [])
      .filter((person, idx, arr) =>
        arr.findIndex(p =>
          p.email === person.email &&
          p.type === person.type) === idx);
    const chairs = people
      .filter(p => p.type === 'Chair')
      .map(p => `${p.name} &lt;${p.email}&gt;`);
    const teamContacts = people
      .filter(p => p.type !== 'Chair')
      .map(p => `${p.name} &lt;${p.email}&gt;`);

    console.log('Report result...');
    const htmlOutput = HtmlService
      .createHtmlOutput(
        (chairs.length > 0 || teamContacts.length > 0) ?
          `<p>
            Use the following list of emails to target Chairs of groups
            set to meet at TPAC:
          </p>
          <p>${chairs.join('<br/>')}</p>

          <p>
            Use the following list of emails to target Team contacts of groups
            set to meet at TPAC:
          </p>
          <p>${teamContacts.join('<br/>')}</p>` :
          `<p>No people found.
          Note export can only work once registration has started.</p>`
      )
      .setWidth(300)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Get list of emails');
    console.log('Report result... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}