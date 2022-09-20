const {stringify} = require("yaml");
const fs = require("fs");

const grid = require("../grid.json"),
      rooms = require("../rooms.json"),
      slots = require("../slots.json");

const arrayify = a => Array.isArray(a) ? a : [a];

const formatAgenda = function(session) {
  return `**Facilitators & speakers**: ${session.proposer.map(p => p.name).join(", ")}

**Session type**: ${session.type}

**Summary**: ${session.summary}

**Goals**:
${session.goals.map(g => `- ${g}`).join('\n')}
`;

}

slots.forEach( (slot, i) => {
  Object.keys(rooms).forEach(async roomid => {
    const sessionId = grid[i][roomid];
    if (!sessionId) return;
    const session = require("../sessions/" + sessionId + ".json");
    session.proposer = arrayify(session.proposer);
    const organizer = session.proposer.find(p => p.id);
    const participants = session.proposer.filter(p => p.id && p.id !== organizer.id);
    const entry = {
      general: {
	title: session.title,
	description: session.summary,
	location: `${rooms[roomid].name} — ${rooms[roomid].floor}`,
	big_meeting: "tpac2022",
	category: "breakout-sessions",
	status: "tentative",
	visibility: session.access === "tpac" ? "member" : "public",
	author: 16289
      },
      dates: {
	start: `2022-09-14 ${slot.start}:00`,
	end: `2022-09-14 ${slot.end}:00`,
	timezone: "America/Vancouver"
      },
      participants: {
	organizers: [organizer.id],
	individuals: participants.length ? participants.map(p => p.id) : undefined
      },
      joining: {
	visibility: session.access === "tpac" ? "registered" : "public",
	url: rooms[roomid].zoom,
	chat: `https://irc.w3.org/?channels=%23${sessionId}`
      },
      agenda: {
	agenda: formatAgenda(session)
      }
    };
    fs.writeFileSync('sessions/' + sessionId + '.yml', stringify(entry), 'utf-8');

  });
});
