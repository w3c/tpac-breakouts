const { JSDOM } = require("jsdom"),
      fs = require("fs"),
      {marked} = require("marked");

const grid = require("../grid.json"),
      rooms = require("../rooms.json"),
      slots = require("../slots.json");

const industries = {
  "web-payments": { "name": "Web Payments Track", class: "im-coin"},
  "media-entertainment": { "name": "Media & Entertainment Track", class: "im-audio"},
  "networks-communications": { "name": "Networks & Communications Track", class: "im-radio"},
  "wot": { "name": "Web of Things & Smart Cities Track", class: "im-factory"},
  "publishing": { "name": "Publishing Track", class: "im-book"},
  "web-advertising": { "name": "Web Advertising Track", class: "im-shopping-cart"}
};

const BEFORE = false;

const arrayify = s => Array.isArray(s) ? s : [s]

const latestSlot = process.argv.length > 2 ? parseInt(process.argv[2], 10) : -1;

JSDOM.fromFile("./lib/template.html").then(dom => {
  const document = dom.window.document;
  const roomTpl = document.getElementById("room");
  const breakTpl = document.getElementById("break");
  const sessionSummaryTpl = document.getElementById("session-summary");
  const slotTpl = document.getElementById("slot");
  const sessionTpl = document.getElementById("session");
  if (BEFORE) {
    const robot = document.createElement("meta");
    robot.setAttribute("name", "robots");
    robot.setAttribute("content", "noindex");
    document.querySelector("head").append(robot);
    Object.values(rooms).forEach(room => {
      const roomEl = document.importNode(roomTpl.content.children[0], true);
      roomEl.querySelector(".name").textContent = room.name;
      roomEl.querySelector(".floor").textContent = "Floor " + room.floor;
      roomTpl.parentNode.insertBefore(roomEl, roomTpl);
    });
  }
  slots.forEach((slot, i) => {
    if (false) {
    } else {
      const slotEl = document.createElement("section");
      slotEl.id = "slot" + (i + 1);
      slotEl.innerHTML = slotTpl.innerHTML;
      slotEl.querySelector(".start").textContent = slot.start;
      slotEl.querySelector(".end").textContent = slot.end;
      const navLink = slotEl.querySelector(".skip a");
      if (i < slots.length - 1) {
        navLink.href = "#slot" + (i + 2);
      } else {
        navLink.href = "#sponsors";
      }
      slotTpl.parentNode.insertBefore(slotEl, slotTpl);
      Object.keys(rooms).forEach(roomid => {
        const room = rooms[roomid];
        const sessionSummaryEl = document.importNode(sessionSummaryTpl.content.children[0], true);
        sessionSummaryEl.querySelector(".room").appendChild(document.createTextNode(room.name));

        if (grid[i] && grid[i][roomid]) {
          const sessionId = grid[i][roomid];
          const session = require("../sessions/" + sessionId + ".json");
          session.proposer = arrayify(session.proposer);
          sessionSummaryEl.querySelector(".title-link").textContent = session.title;
          sessionSummaryEl.querySelector(".title-link").href= "#" + sessionId;

          const sessionEl = document.createElement("div");
          sessionEl.innerHTML = sessionTpl.innerHTML;
          sessionEl.id = sessionId;
	  if (BEFORE) {
	    sessionEl.querySelector(".im-calendar").href = session.calendar;
	  } else {
	    sessionEl.querySelector(".im-calendar").remove();
	  }
          sessionEl.querySelector(".title").textContent = session.title;
          if (session.sponsor) {
            sessionEl.querySelector(".sponsor").textContent += session.sponsor;
          } else {
            sessionEl.querySelector(".sponsor").innerHTML = "";
          }
	  if (session.industry) {
	    const icons = session.industry.map(x => {
	      if (!industries[x]) {
		console.error(`Did not recognize ${x} as an industry tag in ${sessionId}`);
	      }
	      const icon = document.createElement("abbr");
	      icon.className = "picto " + industries[x]["class"];
	      icon.label = industries[x].name;
	      return icon;
	    });
	    sessionEl.querySelector(".tags").append(...icons);
	  } else {
	    sessionEl.querySelector(".tags").remove();
	  }
          sessionEl.querySelector(".summary").innerHTML = marked.parse(session.summary);
          arrayify(session.goals).forEach(goal => {
            const li = document.createElement("li");
            li.innerHTML = marked.parse(goal);
            sessionEl.querySelector(".goals").appendChild(li);
          });
          sessionEl.querySelector(".type").textContent = arrayify(session.type).join(", ");
          const organizerTmpl = sessionEl.querySelector(".organizer");
          session.proposer.forEach((p,i) => {
            const organizerEl = organizerTmpl.cloneNode(true);
            organizerEl.querySelector(".organizer-name").textContent = p.name;
	    if (p.email) {
              organizerEl.querySelector(".organizer-email a").textContent = p.email;
              organizerEl.querySelector(".organizer-email a").href = "mailto:" + p.email;
	    } else {
	      organizerEl.querySelector(".organizer-email").remove();
	    }
            if (p.annotation) {
              organizerEl.appendChild(document.createTextNode(` (${p.annotation})`));
            }
            if (i < session.proposer.length - 1) {
              organizerEl.appendChild(document.createTextNode(", "));
            }
            organizerTmpl.parentNode.insertBefore(organizerEl, organizerTmpl);
          });
          organizerTmpl.remove();
	  /* no longer useful after the event */
	  if (BEFORE) {
            sessionEl.querySelector(".room-name").textContent = room.name;
            sessionEl.querySelector(".room-floor").textContent = room.floor;
            const ircLink = document.createElement("a");
            ircLink.href = "http://irc.w3.org/?channels=%23" + sessionId;
            ircLink.textContent = "#" + sessionId;
            sessionEl.querySelector(".irc").appendChild(ircLink);
            const zoomLink = document.createElement("a");
	    if (session.access !== "tpac") {
              zoomLink.href = room.zoom;
              zoomLink.textContent = "Join with Zoom";
	    } else {
	      zoomLink.href = session.calendar + "#join";
	      zoomLink.textContent = "See W3C Calendar (restricted to registered TPAC participants)";
	    }
	    sessionEl.querySelector(".zoom").appendChild(zoomLink);
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
	  }
	  if (session.slides) {
	    const slideLink = document.createElement("a");
	    slideLink.href = session.slides;
	    slideLink.title = "Slides presented for " + session.title;
	    slideLink.textContent = "slides";
	    sessionEl.querySelector("dd.materials").append(slideLink);
	    if (session.slidespdf) {
	      const pdfLink = document.createElement("a");
	      pdfLink.href = session.slidespdf;
	      pdfLink.textContent = " (PDF copy)";
	      sessionEl.querySelector("dd.materials").append(pdfLink);
	    }
	  } else {
	    sessionEl.querySelectorAll(".materials").forEach(n => n.remove());
	  }
	  if (session.minutes) {
	    const minutesLink = document.createElement("a");
	    minutesLink.href = session.minutes;
	    minutesLink.textContent = "minutes";
	    minutesLink.title = "Minutes of " + session.title;
	    sessionEl.querySelector("dt.minutes").append(minutesLink);
	  } else {
	    sessionEl.querySelectorAll(".minutes").forEach(n => n.remove());
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
  sessionSummaryTpl.remove();
  slotTpl.remove();
  sessionTpl.remove();
  fs.writeFileSync("./sessions.html", dom.serialize());
});

