/**
 * Main script function that registers the "addTPACMenu" trigger across
 * the spreadseets identified in the previous array
 */
export default function () {
  // Ideally, the script would just look for the folder it lives in, but there
  // does not seem to be a way to get a handle on that folder from within the
  // script, so we need to store the ID in the project's settings.
  const scriptProperties = PropertiesService.getScriptProperties();
  const SHARED_FOLDER = scriptProperties.getProperty('SHARED_FOLDER');

  const folder = DriveApp.getFolderById(SHARED_FOLDER);
  const files = folder.getFilesByType(MimeType.GOOGLE_SHEETS);
  while (files.hasNext()) {
    const file = files.next();
    const id = file.getId();
    const triggers = ScriptApp.getProjectTriggers();
    let shouldCreateTrigger = true;
    triggers.forEach(function (trigger) {
      if (trigger.getTriggerSourceId() === id &&
          trigger.getEventType() === ScriptApp.EventType.ON_OPEN &&
          trigger.getHandlerFunction() === 'addTPACMenu') {
        shouldCreateTrigger = false; 
      }
    });
  
    if (shouldCreateTrigger) {
      ScriptApp.newTrigger('addTPACMenu')
        .forSpreadsheet(SpreadsheetApp.openById(id))
        .onOpen()
        .create();
    }
  }
}
