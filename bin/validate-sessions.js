const fs = require("fs");
const util = require("util");
const {validate: jsonvalidate} = require('jsonschema');

const schema = require('../lib/session.schema.json');

const slots = require("../slots.json");
const rooms = require("../rooms.json");

const sessions = {};
const errors = [];
const warnings = [];

// Fail on JSON errors
const loadDir = async dirPath => {
  const files = await util.promisify(fs.readdir)(dirPath);
  return Promise.all(files.filter(path => path.match(/\.json$/)).map(
    path => util.promisify(fs.readFile)(dirPath + "/" + path, 'utf-8')
      .then(JSON.parse)
      .then(data => sessions[path.split('.')[0]] = data)
      .catch(err => { console.error("Failed parsing " + path + ": " + err); process.exit(2);})
  ));
};
loadDir("./sessions/").then(() => {
  const criticalParties = {};
  const uniquelyAcceptable = {};

  Object.keys(sessions).forEach(sessionId =>  {
    const session = sessions[sessionId];
    // Fail if session does not json-schema-validate
    const validation = jsonvalidate(session, schema);
    validation.errors.forEach(e => errors.push(sessionId + ": " + e.stack));

    // Fail if session refers to non-existing time slots
    if (session.possibleSlots && session.possibleSlots.some(s => s < 0 || s >= slots.length))
      errors.push(sessionId + " refers to non-existing slots");

    if (session.possibleSlots && session.possibleSlots.length === 1) {
      if (!uniquelyAcceptable[session.possibleSlots[0]])
        uniquelyAcceptable[session.possibleSlots[0]] = 0
      uniquelyAcceptable[session.possibleSlots[0]]++;
    }

    [session.proposer.login].concat(session.others || []).forEach(p => {
      if (!criticalParties[p])
        criticalParties[p] = 0;
      criticalParties[p]++;
    });
  });
  // Fail is someone is a critical party in more sessions than there are slot
  Object.keys(criticalParties).filter(p => criticalParties[p] >= slots.length)
    .forEach(p =>
             errors.push(`${p} is critical to more sessions (${criticalParties[p]}) than there are open slots`)
            );

  // Fail if a given slot is the uniquely acceptable slot for more sessions than there are rooms
  Object.keys(uniquelyAcceptable).filter(s => uniquelyAcceptable[s] >= rooms.length)
    .forEach(s =>
             errors.push(`Slot #${s} is the only options for ${uniquelyAcceptable[s]} sessions, but there are only ${rooms.length} available`)
            );

  errors.forEach(err => console.error(err));
  warnings.forEach(warning => console.warn(warning));
  if (errors.length) {
    process.exit(2);
  }
});
