import { parseSessionMeetings, groupSessionMeetings } from './meetings.mjs';
import { validateGrid } from './validate.mjs';

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

  // Validate project sessions. Note this will also expand the sessions with
  // useful info (chairs, groups, description)
  const validationIssues = await validateGrid(project);

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
    </style>
  </head>
  <body>
    <h1>${project.metadata.meeting}</h1>`);

  // Start with global stats
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

  // Create one schedule table per day
  writeLine(2, `<section id="schedule">
      <h2>Schedule</h2>`);
  for (const table of tables) {
    // Columns represent the rooms
    writeLine(3, `<section id="d${table.day.date}">
        <h3>${table.day.name}</h3>
        <table>
          <thead>
            <tr>
              <th></th>`);
    for (const room of table.rooms) {
      writeLine(7, '<th>' + room.name + '</th>');
    }
    writeLine(6, `</tr>
          </thead>
          <tbody>`);

    for (const slot of table.slots) {
      // Format the row header (the time slot)
      writeLine(6, `<tr>
              <th>
                ${slot.name}`);

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
          if (capacityIssues.length > 0) {
            classAttr.push('capacity-error');
          }
          const trackIssues = cell.errors.filter(error =>
            error.issue.severity === 'warning' && error.issue.type === 'track');
          if (trackIssues.length > 0) {
            classAttr.push('track-error');
          }

          writeLine(7, `<td class="${classAttr.join(' ')}">`);
          for (const session of cell.atomic) {
            const url = 'https://github.com/' + session.repository + '/issues/' + session.number;
            // Format session number (with link to GitHub) and name
            writeLine(8, `<p><a href="${url}">#${session.number}</a>: ${session.title}`);

            // Format groups/chairs
            if (project.metadata.type === 'groups') {
              writeLine(9, '<br/><i>Group(s): ' + session.groups.map(x => x.name).join(', ') + '</i>');
            }
            else {
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
            if (capacityIssue) {
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
        const url = 'https://github.com/' + session.repository + '/issues/' + session.number;
        writeLine(5, `<li><a href="${url}">#${session.number}</a>: ${session.title}</li>`);
      }
      writeLine(4, `</ul>
        </section>`);
    }

    if (unscheduled.length) {
      writeLine(3, `<section>
        <h3>Unscheduled sessions</h3>
        <ul>`);
      for (const session of unscheduled) {
        const url = 'https://github.com/' + session.repository + '/issues/' + session.number;
        writeLine(5, `<li><a href="${url}">#${session.number}</a>: ${session.title}</li>`);
      }
      writeLine(4, `</ul>
        </section>`);
    }

    if (incomplete.length) {
      writeLine(3, `<section>
        <h3>Partly scheduled</h3>
        <ul>`);
      for (const session of incomplete) {
        const url = 'https://github.com/' + session.repository + '/issues/' + session.number;
        writeLine(5, `<li><a href="${url}">#${session.number}</a>: ${session.title}</li>`);
      }
      writeLine(4, `</ul>
        </section>`);
    }
    writeLine(2, '</section>');
  }

  if (cliParams) {
    writeLine(2, `<section id="cli">
      <h2>Generation parameters</h2>
      <ul>
        <li>preserve: ${cliParams.preserve}${cliParams.preserveInPractice}</li>
        <li>except: ${cliParams.except}</li>
        <li>seed: ${cliParams.seed}</li>
        <li>apply: ${cliParams.apply}</li>
      </ul>
      <p>Command-line command:</p>
      <pre><code>${cliParams.cmd}</code></pre>
    </section>`);
  }

  writeLine(2, `
    <section id="json">
      <h2>Data for Saving/Restoring Schedule</h2>
      <pre id="data">`);
  writeLine(0, JSON.stringify(
    sessions.map(session => Object.assign(
      {
        number: session.number,
        room: session.room,
        day: session.day,
        slot: session.slot
      },
      session.meeting ? { meeting: session.meeting } : {}
    )),
    null, 2));
  writeLine(3, `</pre>
    </section>
  </body>
</html>`);

  return html;
}