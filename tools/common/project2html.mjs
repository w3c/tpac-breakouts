import { parseSessionMeetings, groupSessionMeetings } from './meetings.mjs';
import { validateGrid } from './validate.mjs';
import * as YAML from '../../node_modules/yaml/browser/index.js';

const hasMeeting = s => s.atomicMeetings.find(m => m.room && m.day && m.slot);

/**
 * Convert a project to an HTML page that features one schedule table per
 * day and highlights validation issues.
 */
export async function convertProjectToHTML(project, cliParams) {
  let html = '';
  function writeLine(tab, str) {
    let spaces = '';
    while (tab > 0) {
      spaces += '  ';
      tab -= 1;
    }
    html += spaces + str + '\n';
  }
  // If --reduce show less info
  const reduce = ((typeof cliParams !== 'undefined') && cliParams.reduce)? true : false;

  // Wrap label in a link, unless --reduce flag is set
  const linkSession = (session, reduce) => {
    const url = `https://github.com/${session.repository}/issues/${session.number}`;
    return reduce ? `#${session.number}` : `<a href="${url}">#${session.number}</a>`;
  };

  // Validate project sessions. Note this will also expand the sessions with
  // useful info (chairs, groups, description)
  const { errors: validationIssues } = await validateGrid(project);

  // We'll report sessions that have formatting issues and exclude them from
  // the schedule tables.
  const invalidSessions = project.sessions
    .filter(session => validationIssues.find(err =>
      err.session === session.number &&
      err.severity === 'error' &&
      err.type === 'format'));

  // Start by computing the list of atomic and grouped meetings per session
  const sessions = project.sessions
    .filter(session => !invalidSessions.includes(session))
    .map(session => Object.assign({}, session, {
      atomicMeetings: parseSessionMeetings(session, project),
      groupedMeetings: groupSessionMeetings(session, project)
    }));

  const sessionsWithErrors = sessions
    .filter(session => validationIssues.find(err =>
      err.session === session.number &&
      err.severity === 'error'));
  const sessionsWithWarnings = sessions
    .filter(session => !sessionsWithErrors.includes(session))
    .filter(session => validationIssues.find(err =>
        err.session === session.number &&
        err.severity === 'warning'));
  const okSessions = sessions
    .filter(session => !sessionsWithErrors.includes(session))
    .filter(session => !sessionsWithWarnings.includes(session));

  // Now build the schedule tables. Tables are per day. Table columns are the
  // rooms. Table rows are the slots. Table cells are the meetings. A cell may
  // contain more than one meeting (in case of conflict or if the cell
  // represents a plenary meeting). A cell could in theory span multiple rows,
  // but it's somewhat hard to create a proper HTML table if there are
  // scheduling conflicts, so that is not done yet. A cell cannot span multiple
  // columns.
  const tables = project.days.map(day => {
    const table = {
      day,
      rooms: project.rooms.map(room => Object.assign({ errors: [] }, room)),
      slots: project.slots.map(slot => Object.assign({ errors: [] }, slot)),
      sessions: sessions.filter(session =>
        session.atomicMeetings.find(m => m.day === day.name && m.room && m.slot))
    };
    for (const room of table.rooms) {
      room.sessions = table.sessions.filter(session =>
        session.atomicMeetings.find(m => m.day === day.name && m.room === room.name));
    }
    for (const slot of table.slots) {
      slot.sessions = table.sessions.filter(session =>
        session.atomicMeetings.find(m => m.day === day.name && m.slot === slot.name));
      slot.cells = table.rooms.map(room => Object.assign({
        slot, room,
        errors: [],
        atomic: slot.sessions.filter(session =>
          session.atomicMeetings.find(m =>
            m.day === day.name && m.room === room.name && m.slot === slot.name)),
        grouped: slot.sessions.filter(session =>
          session.groupedMeetings.find(m =>
            m.day === day.name && m.room === room.name && m.start === slot.start))
      }));
    }
    return table;
  });

  // Attach validation issues to the rows, columns and cells, as needed
  for (const issue of validationIssues) {
    if (!issue.details) {
      continue;
    }
    for (const detail of issue.details) {
      const meeting = detail.meeting ?? detail;
      const table = tables.find(t => t.day.name === meeting.day);
      if (!table) {
        continue;
      }
      const slot = table.slots.find(s => s.name === meeting.slot);
      if (!slot) {
        continue;
      }

      if (issue.type === 'chair conflict' ||
          issue.type === 'group conflict' ||
          issue.type === 'track') {
        slot.errors.push({ issue, detail });
      }
      if (meeting.room) {
        const cell = slot.cells.find(c => c.room.name === meeting.room);
        cell.errors.push({ issue, detail });
      }
    }
  }

  // We're ready to output some HTML
  writeLine(0, `<html>
  <head>
    <meta charset="utf-8">
    ${cliParams?.seed ? '<meta name="seed" content="' + cliParams.seed + '">' : ''}
    <title>${project.metadata.meeting} - Event schedule</title>
    <style>
      /* Table styles and colors adapted from Pure CSS:
       * https://github.com/pure-css/pure
       * ... under a BSD License:
       * https://github.com/pure-css/pure/blob/master/LICENSE
       */
      table {
        border-collapse: collapse;
        border-spacing: 0;
        empty-cells: show;
        border: 1px solid #cbcbcb;
      }
      table caption {
        color: #000;
        font: italic 85%/1 arial, sans-serif;
        padding: 1em 0;
        text-align: center;
      }
      table td,
      table th {
        border-left: 1px solid #cbcbcb;
        border-bottom: 1px solid #cbcbcb;
        border-width: 0 0 1px 1px;
        font-size: inherit;
        margin: 0;
        overflow: visible;
        padding: 0.5em 1em;
      }
      table thead {
        background-color: #e0e0e0;
        color: #000;
        text-align: left;
        vertical-align: bottom;
      }
      .conflict-error { background-color: #ddaeff; color: #8156a7; }
      .capacity-error { background-color: #fcebbd; color: #af9540; }
      .track-error { background-color: #e1f2fa; color: #5992aa; }
      .scheduling-error { background-color: #f5ab9e; color: #8c3a2b; }
      .scheduling-warning { background-color: #fcebbd; color: #8c3a2b; }
      .track {
        display: inline-block;
        background-color: #0E8A16;
        color: white;
        border: 1px transparent;
        border-radius: 1em;
        margin-top: 0.2em;
        margin-bottom: 0.2em;
        padding: 3px 10px;
        font-size: smaller;
        white-space: nowrap;
      }
      .nbrooms { font-weight: normal; }
    </style>
    <link rel="stylesheet" href="https://www.w3.org/StyleSheets/TR/base.css" type="text/css"/>
  </head>
  <body>
    <h1>${project.metadata.meeting}</h1>`);

  // Start with global stats
  if (!reduce) {
     writeLine(2, `<section id="overview">
      <h2>Sessions overview</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Not scheduled</th>
            <th>Scheduled</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Format errors</th>
            <td>${invalidSessions.length}</td>
            <td>0</td>
            <td>${invalidSessions.length}</td>
          </tr>
          <tr>
            <th>Validation errors</th>
            <td>${sessionsWithErrors.length - sessionsWithErrors.filter(hasMeeting).length}</td>
            <td>${sessionsWithErrors.filter(hasMeeting).length}</td>
            <td>${sessionsWithErrors.length}</td>
          </tr>
          <tr>
            <th>Validation warnings</th>
            <td>${sessionsWithWarnings.length - sessionsWithWarnings.filter(hasMeeting).length}</td>
            <td>${sessionsWithWarnings.filter(hasMeeting).length}</td>
            <td>${sessionsWithWarnings.length}</td>
          </tr>
          <tr>
            <th>Feel good sessions</th>
            <td>${okSessions.length - okSessions.filter(hasMeeting).length}</td>
            <td>${okSessions.filter(hasMeeting).length}</td>
            <td>${okSessions.length}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th>Total</th>
            <td>${invalidSessions.length + sessionsWithErrors.length + sessionsWithWarnings.length + okSessions.length - sessionsWithErrors.filter(hasMeeting).length - sessionsWithWarnings.filter(hasMeeting).length - okSessions.filter(hasMeeting).length}</td>
            <td>${sessionsWithErrors.filter(hasMeeting).length + sessionsWithWarnings.filter(hasMeeting).length + okSessions.filter(hasMeeting).length}</td>
            <td>${project.sessions.length}</td>
          </tr>
        </tfoot>
      </table>
    </section>`);
  }

  // Create one schedule table per day
  writeLine(2, `<section id="schedule">
      <h2>Schedule</h2>`);
  for (const table of tables) {
    // Columns represent the rooms
    writeLine(3, `<section id="d${table.day.date}">
        <h3>${table.day.label ? table.day.label + ' (' + table.day.date + ')' : table.day.name}</h3>
        <table>
          <thead>
            <tr>
              <th></th>`);
    table.rooms.forEach((room, index) => {
      writeLine(7, `<th>${reduce ? 'Room ' + (index + 1) : room.name}</th>`);
    });
    writeLine(6, `</tr>`);
    writeLine(5, `</thead>`);
    writeLine(5, `<tbody>`);

    for (const slot of table.slots) {
      // Format the row header (the time slot)
      writeLine(6, `<tr>
              <th>
                ${slot.name}`);
      writeLine(8, `<p class="nbrooms">${slot.sessions.length} meetings</p>`);

      const groupConflicts = [... new Set(slot.errors
        .filter(error => error.issue.type === 'group conflict')
        .map(error => error.detail.names)
        .flat())];
      if (groupConflicts.length > 0) {
        writeLine(8, '<p class="conflict-error">Group conflict: ' +
          groupConflicts.join(', ') + '</p>');
      }

      const chairConflicts = [... new Set(slot.errors
        .filter(error => error.issue.type === 'chair conflict')
        .map(error => error.detail.names)
        .flat())];
      if (chairConflicts.length > 0) {
        writeLine(8, '<p class="conflict-error">Chair conflict: ' +
          chairConflicts.join(', ') + '</p>');
      }

      const trackConflicts = [... new Set(slot.errors
        .filter(error => error.issue.type === 'track')
        .map(error => error.detail.track))];
      if (trackConflicts.length > 0) {
        writeLine(8, '<p class="track-error">Same track: ' +
          trackConflicts.join(', ').replace(/track: /g, '') + '</p>');
      }
      writeLine(7, '</th>');

      table.rooms.forEach((room, roomIndex) => {
        const cell = slot.cells[roomIndex];
        if (cell.atomic.length === 0) {
          writeLine(7, '<td></td>');
        }
        else {
          const classAttr = [];
          const peopleIssues = cell.errors.filter(error =>
            error.issue.type === 'group conflict' ||
            error.issue.type === 'chair conflict');
          if (peopleIssues.length > 0) {
            classAttr.push('conflict-error');
          }
          const schedulingIssues = cell.errors.filter(error =>
            error.issue.severity === 'error' && error.issue.type === 'scheduling');
          if (schedulingIssues.length > 0) {
            classAttr.push('scheduling-error');
          }
          const capacityIssues = cell.errors.filter(error =>
            error.issue.severity === 'warning' && error.issue.type === 'capacity');
          if (capacityIssues.length > 0 && !reduce) {
            classAttr.push('capacity-error');
          }
          const trackIssues = cell.errors.filter(error =>
            error.issue.severity === 'warning' && error.issue.type === 'track');
          if (trackIssues.length > 0) {
            classAttr.push('track-error');
          }

          writeLine(7, `<td class="${classAttr.join(' ')}">`);
          for (const session of cell.atomic) {
            // Format session number (with link to GitHub) and name
            writeLine(8, `<p><b>${linkSession(session, reduce)}</b>: ${session.title}`);

            // Format groups/chairs
            if (project.metadata.type !== 'groups') {
              writeLine(9, '<br/><i>Chair(s): ' + session.chairs.map(x => x.name).join(', ') + '</i>');
            }

            // Add tracks if needed
            const tracks = session.labels.filter(label => label.startsWith('track: '));
            if (tracks.length > 0) {
              for (const track of tracks) {
                writeLine(8, `<br/><span class="track">${track}</span>`);
              }
            }

            const sessionIssues = cell.errors.filter(error =>
              error.issue.session === session.number);
            const roomSwitchIssue = sessionIssues.find(error =>
              error.issue.severity === 'warning' && error.issue.type === 'switch');
            if (roomSwitchIssue) {
              const room = project.rooms.find(room => room.name === roomSwitchIssue.detail.previous.room);
              writeLine(8, '<br/><b>Previous slot in</b>: ' +
                '<span class="scheduling-warning">' + room.label + '</span>');
            }

            const conflictIssues = sessionIssues
              .filter(error =>
                error.issue.severity === 'warning' &&
                error.issue.type === 'conflict')
              .map(error => error);
            if (conflictIssues.length > 0) {
              writeLine(8, '<br/><b>Conflicts with</b>: ' +
                conflictIssues
                  .map(error => '<span class="conflict-error">#' + error.detail.conflictsWith.number + '</span>')
                  .join(', '));
            }

            const capacityIssue = capacityIssues
              .find(error => error.issue.session === session.number);
            if (capacityIssue && !reduce) {
              writeLine(8, '<br/><b>Capacity: ' + session.description.capacity + '</b>');
            }
            writeLine(8, '</p>');
          }
          writeLine(7, '</td>');
        }
      });
      writeLine(6, '</tr>');
    }
    writeLine(5, `</tbody>
        </table>
      </section>`);
  }
  writeLine(2, '</section>');

  if (project.metadata.type === 'groups') {
    writeLine(2, `<section id="groups">
      <h2>Groups view</h2>`);
    const groupsView = {};
    for (const session of sessions) {
      for (const group of session.groups) {
        if (!groupsView[group.name]) {
          groupsView[group.name] = {
            group,
            meetings: [],
            sessions: []
          };
        }
        groupsView[group.name].sessions.push(session);
        if (session.groupedMeetings) {
          const meetings = groupsView[group.name].meetings;
          groupsView[group.name].meetings = meetings.concat(
            session.groupedMeetings.map(meeting => Object.assign({ session, meeting }))
          );
        }
      }
    }
    const groupNames = Object.keys(groupsView);
    groupNames.sort();
    for (const name of groupNames) {
      const { group, meetings, sessions } = groupsView[name];
      writeLine(3, `<section id="g${group.w3cId}">
        <h3>${group.name}</h3>`);
      if (meetings.length > 0) {
        meetings.sort((m1, m2) => {
          const day1 = project.days.find(day => day.name === m1.meeting.day);
          const day2 = project.days.find(day => day.name === m2.meeting.day);
          if (day1.date < day2.date) {
            return -1;
          }
          else if (day1.date > day2.date) {
            return 1;
          }
          else if (m1.meeting.start < m2.meeting.start) {
            return -1;
          }
          else if (m1.meeting.start > m2.meeting.start) {
            return 1;
          }
          else {
            return 0;
          }
        });
        writeLine(4, `<ul>`);
        for (const groupMeeting of meetings) {
          const meeting = groupMeeting.meeting;
          const day = project.days.find(day => day.name === meeting.day);
          const room = project.rooms.find(room => room.name === meeting.room);
          const session = groupMeeting.session;
          let jointStr = '';
          let highlightStr = '';
          if (session.groups.length > 1) {
            const groups = session.groups.filter(g => g.name !== name);
            jointStr = `, joint meeting with ` + groups.map(g => g.name).join(', ');
          }
          if (session.highlight) {
            highlightStr = `, topic: ${session.highlight}`;
          }
          writeLine(5, `<li>${day.label}, ${meeting.start} - ${meeting.end}${reduce ? '' : ' (' + room.label + ')'}${jointStr}${highlightStr} (#${session.number})</li>`);
        }
        writeLine(4, `</ul>`);
      }
      for (const session of sessions) {
        if (!hasMeeting(session)) {
          writeLine(4, `<ul class="scheduling-error">
            <li>${linkSession(session, reduce)}: No meeting scheduled</li>
          </ul>`);
        }
        for (const type of ['warning', 'error']) {
          const errors = validationIssues
            .filter(err =>
              err.session === session.number &&
              err.severity === type)
            .map(err => err.messages)
            .flat();
          if (errors.length > 0) {
            writeLine(4, `<ul class="scheduling-${type}">`);
            for (const error of errors) {
              writeLine(5, `<li>${linkSession(session, reduce)}: ${error}</li>`);
            }
            writeLine(4, `</ul>`);
          }
        }
      }
      writeLine(3, `</section>`);
    }
    writeLine(2, '</section>');
  }



  const unscheduled = sessions.filter(session => !hasMeeting(session));
  const incomplete = sessions
    .filter(session => hasMeeting(session))
    .filter(session => session.atomicMeetings.find(m => !(m.room && m.day && m.slot)));
  if (invalidSessions.length || unscheduled.length || incomplete.length) {
    writeLine(2, `<section id="todo">
        <h2>Sessions to look into</h2>`);
    if (invalidSessions.length) {
      writeLine(3, `<section>
        <h3>Fix format issues</h3>
        <ul>`);
      for (const session of invalidSessions) {
        writeLine(5, `<li>${linkSession(session, reduce)}: ${session.title}</li>`);
      }
      writeLine(4, `</ul>
        </section>`);
    }

    if (unscheduled.length) {
      writeLine(3, `<section>
        <h3>Unscheduled sessions</h3>
        <ul>`);
      for (const session of unscheduled) {
        writeLine(5, `<li>${linkSession(session, reduce)}: ${session.title}</li>`);
      }
      writeLine(4, `</ul>
        </section>`);
    }

    if (incomplete.length) {
      writeLine(3, `<section>
        <h3>Partly scheduled</h3>
        <ul>`);
      for (const session of incomplete) {
        writeLine(5, `<li>${linkSession(session, reduce)}: ${session.title}</li>`);
      }
      writeLine(4, `</ul>
        </section>`);
    }
    writeLine(2, '</section>');
  }

  if (cliParams?.cmd && !reduce) {
    writeLine(2, `<section id="cli">
      <h2>Generation parameters</h2>
      <ul>
        <li>preserve: ${cliParams.preserve}${cliParams.preserveInPractice}</li>
        <li>except: ${cliParams.except}</li>
        <li>seed: ${cliParams.seed}</li>
        <li>apply: ${cliParams.apply}</li>
        <li>reduce: ${cliParams.reduce}</li>
      </ul>
      <p>Command-line command:</p>
      <pre><code>${cliParams.cmd}</code></pre>
    </section>`);
  }

  const yaml = sessions.map(session => Object.assign({
    number: session.number,
    reset: 'all',
    room: session.room,
    day: session.day,
    slot: session.slot,
    meeting: session.meeting?.split(';').map(m => m.trim())
  }));
  if (!reduce) {
    writeLine(2, `<section id="yaml">
      <h2>Data for Saving/Restoring Schedule</h2>
      <pre id="data">`);
    writeLine(0, YAML.stringify(yaml));
    writeLine(3, `</pre>
    </section>`);
  }
  writeLine(1, `</body>`);
  writeLine(0, `</html>`);
  return html;
}