const { JSDOM } = require("jsdom"),
      fs = require("fs");

const grid = require("../grid.json"),
      rooms = require("../rooms.json"),
      slots = require("../slots.json");

const arrayify = s => Array.isArray(s) ? s : [s]

JSDOM.fromFile("./lib/template.html").then(dom => {
  const document = dom.window.document;
  const roomTpl = document.getElementById("room");
  const slotSummaryTpl = document.getElementById("slot-summary");
  const sessionSummaryTpl = document.getElementById("session-summary");
  const slotTpl = document.getElementById("slot");
  const sessionTpl = document.getElementById("session");
  Object.values(rooms).forEach(room => {
    const roomEl = document.importNode(roomTpl.content.children[0], true);
    roomEl.querySelector(".name").textContent = room.name;
    roomEl.querySelector(".floor").textContent = "Floor " + room.floor;
    roomTpl.parentNode.insertBefore(roomEl, roomTpl);
  });
  slots.forEach((slot, i) => {
    const slotSummaryEl = document.importNode(slotSummaryTpl.content.children[0], true);
    slotSummaryEl.querySelector(".start").textContent = slot.start;
    slotSummaryEl.querySelector(".end").textContent = slot.end;
    slotSummaryTpl.parentNode.insertBefore(slotSummaryEl, slotSummaryTpl);

    const slotEl = document.createElement("section");
    slotEl.id = "slot" + (i + 1);
    slotEl.innerHTML = slotTpl.innerHTML;
    slotEl.querySelector(".start").textContent = slot.start;
    slotEl.querySelector(".end").textContent = slot.end;
    const navLink = slotEl.querySelector(".skip a");
    if (i < slots.length - 1) {
      navLink.href = "https://w3c.github.io/tpac-breakouts/sessions.html#slot" + (i + 2);
    } else {
      navLink.href = "https://w3c.github.io/tpac-breakouts/sessions.html" + navLink.dataset.last;
    }
    slotTpl.parentNode.insertBefore(slotEl, slotTpl);
    Object.keys(rooms).forEach(roomid => {
      const room = rooms[roomid];
      const sessionSummaryEl = document.importNode(sessionSummaryTpl.content.children[0], true);
      sessionSummaryEl.querySelector(".room").appendChild(document.createTextNode(room.name));
      slotSummaryEl.appendChild(sessionSummaryEl);

      if (grid[i] && grid[i][roomid]) {
        const sessionId = grid[i][roomid];
        const session = require("../sessions/" + sessionId + ".json");

        sessionSummaryEl.querySelector(".title-link").textContent = session.title;
        sessionSummaryEl.querySelector(".title-link").href= "https://w3c.github.io/tpac-breakouts/sessions.html#" + sessionId;

        const sessionEl = document.createElement("div");
        sessionEl.innerHTML = sessionTpl.innerHTML;
        sessionEl.id = sessionId;
        sessionEl.querySelector(".title").textContent = session.title;
        if (session.sponsor) {
          sessionEl.querySelector(".sponsor").textContent += session.sponsor;
        } else {
          sessionEl.querySelector(".sponsor").innerHTML = "";
        }
        sessionEl.querySelector(".room-name").textContent = room.name;
        sessionEl.querySelector(".room-floor").textContent = "Floor " + room.floor;
        sessionEl.querySelector(".summary").innerHTML = session.summary;
        arrayify(session.goals).forEach(goal => {
          const li = document.createElement("li");
          li.textContent = goal;
          sessionEl.querySelector(".goals").appendChild(li);
        });
        sessionEl.querySelector(".type").textContent = arrayify(session.type).join(", ");
        sessionEl.querySelector(".organizer-name").textContent = session.proposer.name;
        sessionEl.querySelector(".organizer-email").textContent = session.proposer.email;
        sessionEl.querySelector(".organizer-email").href = "mailto:" + session.proposer.email;
        const ircLink = document.createElement("a");
        ircLink.href = "http://irc.w3.org/?channels=%23" + sessionId;
        ircLink.textContent = "#" + sessionId;
        sessionEl.querySelector(".irc").appendChild(ircLink);
        slotEl.appendChild(sessionEl);
      } else {
        sessionSummaryEl.querySelector(".title-link").remove();
      }
    });
  });
  roomTpl.remove();
  slotSummaryTpl.remove();
  sessionSummaryTpl.remove();
  slotTpl.remove();
  sessionTpl.remove();
  fs.writeFileSync("./sessions.html", dom.serialize());
});

