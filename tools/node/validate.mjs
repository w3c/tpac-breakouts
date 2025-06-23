import path from 'path';
import { updateSessionDescription } from '../common/session.mjs';
import { exportProjectToGitHub } from '../common/project.mjs';
import { validateSession, validateGrid } from '../common/validate.mjs';

/**
 * Helper function to generate a shortname from the session's title
 */
function generateShortname(session) {
  return '#' + session.title
    .toLowerCase()
    .replace(/\([^\)]\)/g, '')
    .replace(/[^a-z0-0\-\s]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Retrieve the name of the IRC channel to use for plenary sessions. That name
 * can be defined in the project's description on GitHub. If the name is not
 * specified, `#plenary` is used.
 */
function getProjectPlenaryShortname(project) {
  const channel = project.metadata['plenary channel'];
  if (channel && channel.startsWith('#')) {
    return channel;
  }
  else if (channel) {
    return '#' + channel;
  }
  else {
    return '#plenary';
  }
}

export default async function (project, number, options) {
  const sessionToValidate =
    (number.trim().toLowerCase() === 'all') ?
      'all' :
      (number.trim().match(/^\d+$/)?.[0] ?? null);
  if (sessionToValidate === null) {
    throw new Error(`Invalid argument passed as parameter. Expected "all" or a session number and got "${number}"`);
  }

  if (sessionToValidate === 'all') {
    console.warn();
    console.warn(`Validate grid...`);
    const { errors, changes } = await validateGrid(project, options);
    console.warn(`- ${errors.length} problems found`);
    console.warn(`- ${changes.length} changes found`);
    console.warn(`Validate grid... done`);

    for (const change of changes) {
      console.warn();
      console.warn(`Save validation results for session ${change.number}...`);
      const session = project.sessions.find(s => s.number === change.number);
      session.validation.error = change.validation.error;
      session.validation.warning = change.validation.warning;
      session.validation.check = change.validation.check;
      console.warn(`Save validation results for session ${change.number}... done`);
    }

    console.warn(`Export validation results to GitHub...`);
    await exportProjectToGitHub(project, 'validation');
    console.warn(`Export validation results to GitHub... done`);
  }
  else {
    const sessionNumber = parseInt(number, 10);
    const session = project.sessions.find(s => s.number === sessionNumber);
    console.warn();
    console.warn(`Validate session ${sessionNumber}...`);
    let changes;
    if (options.changes) {
      const changesFileUrl = 'file:///' +
          path.join(process.cwd(), options.changes).replace(/\\/g, '/');
      ({ default: changes } = await import(
        changesFileUrl,
        { with: { type: 'json' } }
      ));
    }
    const report = await validateSession(sessionNumber, project, changes);
    for (const error of report) {
      console.warn(`- ${error.severity}:${error.type}: ${error.messages.join(', ')}`);
    }
    console.warn(`Validate session ${sessionNumber}... done`);

    // No IRC channel provided, one will be created below, let's add a
    // "check: irc channel" flag
    if (!report.find(err => err.severity === 'error' && err.type === 'format') &&
        project.sessionSections.find(section => section.id === 'shortname') &&
        !session.description.shortname &&
        (session.description.type !== 'plenary')) {
      report.push({
        session: sessionNumber,
        severity: 'check',
        type: 'irc channel',
        messages: ['IRC channel was generated from the title']
      });
    }

    // Time to record session validation issues
    console.warn();
    console.warn(`Save session validation results...`);
    for (const severity of ['error', 'warning', 'check']) {
      let results = report
        .filter(error => error.severity === severity)
        .map(error => error.type)
        .sort();
      if (severity === 'check' &&
          session.validation.check?.includes('irc channel') &&
          !results.includes('irc channel')) {
        // Need to keep the 'irc channel' value until an admin removes it
        results.push('irc channel');
        results = results.sort();
      }
      else if (severity === 'warning' && session.validation.note) {
        results = results.filter(warning => {
          const keep =
            !session.validation.note.includes(`-warning:${warning}`) &&
            !session.validation.note.includes(`-warn:${warning}`) &&
            !session.validation.note.includes(`-w:${warning}`);
          if (!keep) {
            console.warn(`- drop warning:${warning} per note`);
          }
          return keep;
        });
      }
      session.validation[severity] = results.join(', ');
    }
    await exportProjectToGitHub(project, 'validation');
    console.warn(`Save session validation results... done`);

    // Prefix IRC channel with '#' if not already done
    if (!report.find(err => err.severity === 'error' && err.type === 'format') &&
        session.description.shortname &&
        !session.description.shortname.startsWith('#')) {
      console.warn();
      console.warn(`Add '#' prefix to IRC channel...`);
      session.description.shortname = '#' + session.description.shortname;
      console.warn(`Add '#' prefix to IRC channel... done`);
    }

    // Or force IRC channel to the plenary one if session is a plenary session
    const plenaryShortname = getProjectPlenaryShortname(project);
    if (!report.find(err => err.severity === 'error' && err.type === 'format') &&
        (session.description.type === 'plenary') &&
        (session.description.shortname !== plenaryShortname)) {
      console.warn();
      console.warn(`Associate session with plenary IRC channel...`);
      session.description.shortname = plenaryShortname;
      console.warn(`Associate session with plenary IRC channel... done`);
    }
    // Or generate IRC channel if it was not provided
    else if (!report.find(err => err.severity === 'error' && err.type === 'format') &&
        project.sessionSections.find(section => section.id === 'shortname') &&
        !session.description.shortname) {
      console.warn();
      console.warn(`Generate IRC channel...`);
      session.description.shortname = generateShortname(session);
      console.warn(`Generate IRC channel... done`);
    }

    // Note: no way to re-generate the session's description if there's a
    // format error.
    if (!report.find(err => err.severity === 'error' && err.type === 'format')) {
      console.warn(`Update session description if needed...`);
      await updateSessionDescription(session);
      console.warn(`Update session description if needed... done`);
    }
  }
}