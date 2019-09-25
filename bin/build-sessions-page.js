const { JSDOM } = require("jsdom"),
      fs = require("fs");

const grid = require("../grid.json"),
      rooms = require("../rooms.json"),
      slots = require("../slots.json");

const arrayify = s => Array.isArray(s) ? s : [s]

const latestSlot = process.argv.length > 2 ? parseInt(process.argv[2], 10) : -1;

JSDOM.fromFile("./lib/template.html").then(dom => {
  const document = dom.window.document;
  const roomTpl = document.getElementById("room");
  const slotSummaryTpl = document.getElementById("slot-summary");
  const breakTpl = document.getElementById("break");
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
    if (slot.break) {
      // TODO: DRY
      const breakSummaryEl = document.importNode(slotSummaryTpl.content.children[0], true);
      breakSummaryEl.querySelector(".start").textContent = slot.start;
      breakSummaryEl.querySelector(".end").textContent = slot.end;
      const sessionSummaryEl = document.importNode(sessionSummaryTpl.content.children[0], true);
      sessionSummaryEl.querySelector(".room").appendChild(document.createTextNode(slot.room));
      sessionSummaryEl.querySelector(".title-link").innerHTML = slot.name;
      breakSummaryEl.appendChild(sessionSummaryEl);
      slotSummaryTpl.parentNode.insertBefore(breakSummaryEl, slotSummaryTpl);

      const breakEl = document.createElement("section");
      breakEl.innerHTML = breakTpl.innerHTML;
      breakEl.id = "slot" + (i + 1);
      breakEl.querySelector(".start").textContent = slot.start;
      breakEl.querySelector(".end").textContent = slot.end;
      breakEl.querySelector(".name").innerHTML = slot.name;
      breakEl.querySelector(".room").textContent = slot.room;
      const navLink = breakEl.querySelector(".skip a");
      if (i < slots.length - 1) {
        navLink.href = "https://w3c.github.io/tpac-breakouts/sessions.html#slot" + (i + 2);
      } else {
        navLink.href = "https://w3c.github.io/tpac-breakouts/sessions.html" + navLink.dataset.last;
      }
      breakTpl.parentNode.insertBefore(breakEl, slotTpl);
    } else {
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
          session.proposer = arrayify(session.proposer);
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
          const organizerTmpl = sessionEl.querySelector(".organizer");
          session.proposer.forEach((p,i) => {
            const organizerEl = organizerTmpl.cloneNode(true);
            organizerEl.querySelector(".organizer-name").textContent = p.name;
            organizerEl.querySelector(".organizer-email").textContent = p.email;
            organizerEl.querySelector(".organizer-email").href = "mailto:" + p.email;
            if (p.annotation) {
              organizerEl.appendChild(document.createTextNode(` (${p.annotation})`));
            }
            if (i < session.proposer.length - 1) {
              organizerEl.appendChild(document.createTextNode(", "));
            }
            organizerTmpl.parentNode.insertBefore(organizerEl, organizerTmpl);
          });
          organizerTmpl.remove();
          const ircLink = document.createElement("a");
          ircLink.href = "http://irc.w3.org/?channels=%23" + sessionId;
          ircLink.textContent = "#" + sessionId;
          sessionEl.querySelector(".irc").appendChild(ircLink);
          if (session.remote) {
            const remote = document.createElement("dt");
            remote.textContent = "Remote participation";
            const dd = document.createElement("dd");
            if (session.remote === true) {
              dd.textContent = "Yes";
            } else {
              dd.innerHTML = session.remote;
            }
            sessionEl.querySelector("dl").appendChild(remote);
            sessionEl.querySelector("dl").appendChild(dd);
          }
          if (i <= latestSlot) {
            const dt = document.createElement("dt");
            dt.textContent = "Minutes";
            const dd = document.createElement("dd");
            const minutesLink = document.createElement("a");
            if (!session.minutes) {
              minutesLink.href = "https://www.w3.org/2019/09/18-" + sessionId + "-minutes.html";
              minutesLink.textContent = "Notes taken on #" + sessionId;
            } else {
              minutesLink.href = session.minutes;
              minutesLink.textContent = "Notes";
            }
            dd.appendChild(minutesLink);
            sessionEl.querySelector("dl").appendChild(dt);
            sessionEl.querySelector("dl").appendChild(dd);
            if (session.report) {
              const reportDt = document.createElement("dt");
              reportDt.textContent = "Summarized report";
              const reportDd = document.createElement("dd");
              reportDd.innerHTML = session.report;
              sessionEl.querySelector("dl").appendChild(reportDt);
              sessionEl.querySelector("dl").appendChild(reportDd);
            }
          }
          slotEl.appendChild(sessionEl);
        } else {
          sessionSummaryEl.querySelector(".title-link").remove();
        }
      });
    }
  });
  roomTpl.remove();
  slotSummaryTpl.remove();
  sessionSummaryTpl.remove();
  slotTpl.remove();
  sessionTpl.remove();
  fs.writeFileSync("./sessions.html", dom.serialize());
});

