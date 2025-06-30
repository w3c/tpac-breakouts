import reportError from './lib/report-error.mjs';

export default async function () {
  try {
    console.log('Read authorization token from spreadsheet...');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const tokenMetadata = spreadsheet.getDeveloperMetadata()
      .find(d => d.getKey() === 'W3C_TOKEN');
    console.log(tokenMetadata ? '- token already set' : '- no token set for now');
    console.log('Read data from spreadsheet... done');

    console.log('Get authorization token from user...');
    const ui = SpreadsheetApp.getUi();
    let token = '';
    const response = ui.prompt(
      (tokenMetadata ?
        'Note: The spreadsheet is already associated with an authorization token, ' +
        'you should only need to update it if the token changed!\n\n' :
        '') +
      'Please provide the authorization token to use to retrieve the list of registrants and interact with the calendar.\n\n' +
      'Hit "Cancel" to cancel the edition' +
      (tokenMetadata ? ' and keep the current token' : '') + '.',
      ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() === ui.Button.OK) {
      console.log('- new token provided by user');
      token = response.getResponseText();
    }
    else {
      console.log('- no token provided');
      token = null;
    }
    console.log('Get authorization token from user... done');

    if (token !== null) {
      console.log('Save authorization token to spreadsheet...');
      if (token === '') {
        if (tokenMetadata) {
          tokenMetadata.remove();
        }
      }
      else {
        if (tokenMetadata) {
          tokenMetadata.setValue(token);
        }
        else {
          spreadsheet.addDeveloperMetadata('W3C_TOKEN', token);
        }
      }
      console.log('Save authorization token to spreadsheet... done');
    }
  }
  catch(err) {
    reportError(err.toString());
    return;
  }
}