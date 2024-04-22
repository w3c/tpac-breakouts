import * as assert from 'node:assert';
import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/lib/envkeys.mjs';
import { fetchProject, convertProjectToJSON } from '../tools/lib/project.mjs';
import { validateSession, validateGrid } from '../tools/lib/validate.mjs';
import { suggestSchedule } from '../tools/lib/schedule.mjs';

async function fetchTestProject() {
  return fetchProject(
    await getEnvKey('PROJECT_OWNER'),
    await getEnvKey('PROJECT_NUMBER'));
}

function checkMeetingsAgainstTimes(project) {
  const unscheduled = project.sessions
    .map(session => session.description.times
      .map(time => Object.assign({ session }, time))
      .filter(time => {
        const day = project.days.find(day => day.name === time.day);
        const slot = project.slots.find(slot => slot.name === time.slot);
        return !session.meeting?.includes(`${day.label}, ${slot.start}`);
      }))
    .flat()
    .map(time => `Session #${time.session.number} not scheduled on ${time.day} at ${time.slot}`);
  assert.deepStrictEqual(unscheduled, []);
  // `session #${session.number} not scheduled on ${day.label} at ${slot.start}`);
}

// Test data contains a few meetings of groups that are not real W3C groups.
// (Note -1, 'closed', and 'BFF' mean the exact same thing: the group can meet
// but we don't have any way to map it to a W3C ID)
const nonW3CGroupMeetings = {
  'WHATWG': -1,
  'Web Platform Tests': -1,
  'SocialWeb CG': -1,
  'Semantic Industries CG': 'closed',
  'W3C Chapters and Evangelists': 'BFF'
};

describe('Scheduling of TPAC meetings', function () {
  before(function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'tpac2023');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/tpac-template.yml');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/tpac-template.yml');
  });

  it('parses a group issue', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 61;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
    //console.log(JSON.stringify(project.sessions.find(s => s.number === sessionNumber), null, 2));
  });

  it('validates the Advisory Committee meeting issue', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 29;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
    //console.log(JSON.stringify(project.sessions.find(s => s.number === sessionNumber), null, 2));
  });

  it('validates all TPAC 2023 meetings', async function () {
    const project = await fetchTestProject();
    project.chairsToW3CID = nonW3CGroupMeetings;
    const errors = await validateGrid(project);
    assert.deepStrictEqual(errors, []);
  });

  it('respects requested times', async function () {
    const project = await fetchTestProject();
    project.chairsToW3CID = nonW3CGroupMeetings;
    const errors = await validateGrid(project);
    assert.deepStrictEqual(errors, []);

    suggestSchedule(project, { seed: 'schedule' });
    checkMeetingsAgainstTimes(project);

    const scheduleErrors = (await validateGrid(project))
      .filter(error => error.severity === 'error');
    assert.deepStrictEqual(scheduleErrors, []);
  });

  it('respects requested times regardless of seed', async function () {
    const project = await fetchTestProject();
    project.chairsToW3CID = nonW3CGroupMeetings;
    const errors = await validateGrid(project);
    assert.deepStrictEqual(errors, []);

    suggestSchedule(project, { seed: 'another' });
    checkMeetingsAgainstTimes(project);
  });
});