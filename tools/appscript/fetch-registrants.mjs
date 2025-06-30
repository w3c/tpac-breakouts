import reportError from './lib/report-error.mjs';
import { getProject } from './lib/project.mjs';
import { getEnvKey } from '../common/envkeys.mjs';
import { fetchRegistrants } from '../common/registrants.mjs';

export default async function () {
  try {
    console.log('Read data from spreadsheet...');
    const project = getProject(SpreadsheetApp.getActiveSpreadsheet());
    console.log('Read data from spreadsheet... done');

    if (project.metadata.type !== 'groups') {
      reportError(`Cannot retrieve the list of registrants as event is not of type "TPAC group meetings".

    Check the "Type" parameter in the "Event" sheet.`);
      return;
    }

    if (!project.metadata.slug) {
      reportError(`Happy to oblige, but I need the event's slug!

  Make sure that the "Meeting slug" parameter is set in the "Event" sheet.`);
      return;
    }

    const W3C_TOKEN = await getEnvKey('W3C_TOKEN', '');
    if (!W3C_TOKEN) {
      reportError(`Happy to oblige, but I need an authorization token.

  Use the "Set authorization token" menu in "Event > Advanced > For TPAC group meetings only".`);
      return;
    }

    console.log('Fetch the list of registrants...');
    const registrants = await fetchRegistrants(project);
    console.warn(JSON.stringify(registrants, null, 2));
    console.log('Fetch the list of registrants... done');

    // TODO: in tools/common/registrants.mjs - mapRegistrantsToProject
    // TODO: in tools/appscript/lib/project.mjs - update refreshProject
    // TODO: in tools/appscript/lib/project.mjs - read registrants info from the sheets
    // TODO: in tools/common/project.mjs - save registrants info in variables
    // TODO: in tools/common/project.mjs - read registrants info from variables
    // TODO: in tools/common/validate.mjs - match registrants against room capacity

    console.log('Refresh info in spreadsheet...');
    refreshProject(spreadsheet, project, { what: 'registrants' });
    console.log('Refresh info in spreadsheet... done');
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}