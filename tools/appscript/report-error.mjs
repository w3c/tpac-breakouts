/**
 * Report an error to the user
 *
 * Note that we can only display an alert when the script runs from within the spreadsheet
 * (so typically not when running in debug mode)
 */
export default function (msg) {
  const ui = SpreadsheetApp.getActiveSpreadsheet() ? SpreadsheetApp.getUi() : null;
  if (ui) {
    ui.alert('Error', msg, ui.ButtonSet.OK);
  }
  console.error(msg);
}