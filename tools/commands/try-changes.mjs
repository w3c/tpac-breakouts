import { validateGrid } from '../lib/validate.mjs';
import { saveSessionMeetings } from '../lib/project.mjs';
import { convertProjectToHTML } from '../lib/project2html.mjs';

export default async function (project, options) {
  if (!project.allowTryMeOut) {
    throw new Error(`No "Try me out" custom field in project`);
  }

  if (!project.sessions.find(session => session.trymeout)) {
    throw new Error(`No schedule adjustments to try!`);
  }

  console.warn();
  console.warn(`Adjust schedule with "Try me out" field...`);
  for (const session of project.sessions) {
    if (session.trymeout) {
      // TODO: also support "try me out" for breakout sessions,
      // updating the room, day and slot fields instead of meeting which
      // does not exist for breakout sessions.
      session.meeting = session.trymeout;
      session.trymeout = null;
      session.updated = true;
      console.warn(`- session ${session.number}: from "${session.meeting}" to "${session.trymeout}"`);
    }
  }
  console.warn(`Adjust schedule with "Try me out" field... done`);

  console.warn();
  console.warn(`Validate created grid...`);
  const { errors: newErrors } = await validateGrid(project, { what: 'scheduling' })
  if (newErrors.length) {
    for (const error of newErrors) {
      console.warn(`- [${error.severity}: ${error.type}] #${error.session}: ${error.messages.join(', ')}`);
    }
  }
  else {
    console.warn(`- looks good!`);
  }
  console.warn(`Validate created grid... done`);

  console.warn();
  console.warn(`Report project as HTML...`);
  const html = await convertProjectToHTML(project);
  console.warn();
  console.log(html);
  console.warn(`Report project as HTML... done`);

  if (options.apply) {
    console.warn();
    console.warn(`Apply created grid...`);
    const sessionsToUpdate = project.sessions.filter(s => s.updated);
    for (const session of sessionsToUpdate) {
      console.warn(`- updating #${session.number}...`);
      await saveSessionMeetings(session, project);
      console.warn(`- updating #${session.number}... done`);
    }
    console.warn(`Apply created grid... done`);
  }
}
