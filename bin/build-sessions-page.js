const { JSDOM } = require("jsdom"),
      fs = require("fs");

const grid = require("../grid.json"),
      rooms = require("../rooms.json"),
      slots = require("../slots.json");

const arrayify = s => Array.isArray(s) ? s : [s]

JSDOM.fromFile("./lib/template.html").then(dom => {
  const document = dom.window.document;
  const slotTpl = document.getElementById("slot");
  const sessionTpl = document.getElementById("session");
  slots.forEach((slot, i) => {
    const slotEl = document.createElement("section");
    slotEl.id = "slot" + (i + 1);
    slotEl.innerHTML = slotTpl.innerHTML;
    slotEl.querySelector("h2 .start").textContent = slot.start;
    slotEl.querySelector("h2 .end").textContent = slot.end;
    document.getElementById("slot").parentNode.insertBefore(slotEl, slotTpl);
    Object.keys(rooms).forEach(roomid => {
      if (grid[i] && grid[i][roomid]) {
        const sessionId = grid[i][roomid];
        const room = rooms[roomid];
        const session = require("../sessions/" + sessionId + ".json");
        const sessionEl = document.createElement("div");
        sessionEl.innerHTML = sessionTpl.innerHTML;
        sessionEl.id = sessionId;
        sessionEl.querySelector(".title").textContent = session.title + " - " + room.name;
        sessionEl.querySelector(".room-name").textContent = room.name;
        sessionEl.querySelector(".room-floor").textContent = "Floor " + room.floor;
        sessionEl.querySelector(".summary").innerHTML = session.summary;
        arrayify(session.goals).forEach(goal => {
          const li = document.createElement("li");
          li.textContent = goal;
          sessionEl.querySelector(".goals").appendChild(li);
        });
        sessionEl.querySelector(".type").textContent = arrayify(session.type).join(", ");
        sessionEl.querySelector(".organizer").textContent = session.proposer.name;
        const ircLink = document.createElement("a");
        ircLink.href = "http://irc.w3.org/?channels=%23" + sessionId;
        ircLink.textContent = "#" + sessionId;
        sessionEl.querySelector(".irc").appendChild(ircLink);
        slotEl.appendChild(sessionEl);
      }
    });
  });
  slotTpl.remove();
  sessionTpl.remove();
  fs.writeFileSync("./sessions.html", dom.serialize());
});

