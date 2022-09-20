const fs = require("fs");
const util = require("util");

// If no grid, no work
let grid;
try {
  grid = require("../grid.json");
} catch (e) {
  console.log("No grid to be checked, exiting");
  process.exit(0);
}

const rooms = require("../rooms.json");

const compareSize = ({capacity: cap1}, {size: cap2} ) => {
  if (!cap1) return 0;
  const map = {big: 2, medium: 1, small: 0};
  return map[cap1] - map[cap2];
};

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

  Object.keys(sessions).forEach(sessionId =>  {
    const sessionSlots = grid.filter(slot => Object.values(slot).includes(sessionId));
    // Fail if a session appears nowhere
    if (sessionSlots.length === 0)
      errors.push(`Session ${sessionId} not in grid`);
    // Fail if a given session appears in multiple slot
    const span = sessions[sessionId].span || 1;
    if (sessionSlots.length > span)
      errors.push(`Session ${sessionId} twice in grid`);

  });

  grid.forEach((slot,i) => {
    const criticalParties = new Set();
    const tracks = {};
    Object.keys(slot).forEach(roomId => {
      // Fail if a slot refers to an unknown room
      if (!rooms[roomId])
        return errors.push(`In slot #${i}, unknown room ${roomId}`);
      const sessionId = slot[roomId];

      if (!sessionId) return;
      // Fail if a room is assigned to an unknown session
      if (!sessions[sessionId])
        return errors.push(`In slot #${i}, unknown session ${slot[roomId]}`);

      const session = sessions[sessionId];
      session.proposer = Array.isArray(session.proposer) ? session.proposer : [session.proposer];
      const room = rooms[roomId];

      // Fail if a given session doesn't respect its time constraints
      if (Array.isArray(session.possibleSlots) && !session.possibleSlots.includes(i))
        errors.push(`Session ${sessionId} scheduled in slot #${i} but that is not an acceptable slot for that session`);

      // Warn if a session is in a smaller room than requested
      if (compareSize(session, room) > 0)
        warnings.push(`Room ${roomId} is ${room.capacity} and hosts session ${sessionId} which needs ${session.capacity}`);

      // Warn if a session has conflicts in critical parties
      for (let p of session.proposer.map(p => p.name).concat(session.others || [])) {
        if (criticalParties.has(p))
          warnings.push(`Session ${sessionId} scheduled in slot #${i}, but ${p} is critical in another session of that slot`);
        criticalParties.add(p);
      }

      // Warn if a session needs remote but is in a room that doesn't support it
      if (session.remote && !room.remote) {
          warnings.push(`Session ${sessionId} scheduled in room ${roomId} needs remote support but that room doesn't provide remote support`);
      }

      if (session.track) {
        if (!tracks[session.track]) {
          tracks[session.track] = new Set();
        }
        if (tracks[session.track].has(slot))
          warnings.push(`Session ${sessionId} scheduled in slot #${i}, but another session of the track ${session.track} is scheduled in that slot`);
        tracks[session.track].add(slot);
      }
    });
  });


  errors.forEach(err => console.error(err));
  warnings.forEach(warning => console.warn(warning));
  if (errors.length) {
    process.exit(2);
  }
});
