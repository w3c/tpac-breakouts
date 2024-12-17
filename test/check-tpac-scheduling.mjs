import * as assert from 'node:assert';
import { readFile, writeFile } from 'node:fs/promises';
import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/node/lib/envkeys.mjs';
import { fetchProject } from '../tools/node/lib/project.mjs';
import { validateSession, validateGrid } from '../tools/node/lib/validate.mjs';
import { convertProjectToHTML } from '../tools/node/lib/project2html.mjs';
import { suggestSchedule } from '../tools/common/schedule.mjs';

async function fetchTestProject() {
  const project = await fetchProject(
    await getEnvKey('PROJECT_OWNER'),
    await getEnvKey('PROJECT_NUMBER'));
  project.w3cIds = nonW3CGroupMeetings;
  return project;
}

function stripDetails(errors) {
  return errors.map(err => {
    if (err.details) {
      delete err.details;
    }
    return err;
  });
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
}

async function assertSameAsRef(html) {
  const refName = await getEnvKey('PROJECT_NUMBER');
  const refFilename = `test/data/ref-${refName}.html`;
  const updateRef = await getEnvKey('UPDATE_REFS', false);
  if (updateRef) {
    await writeFile(refFilename, html, 'utf8');
  }
  const refHtml = (await readFile(refFilename, 'utf8'))
    .replace(/\r/g, '');
  assert.strictEqual(html, refHtml);
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
  this.timeout(10000);

  before(function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'tpac2023');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-tpac2023.yml');
  });

  it('parses a group issue', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 61;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('validates the Advisory Committee meeting issue', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 29;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('validates all TPAC 2023 meetings', async function () {
    const project = await fetchTestProject();
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);
  });

  it('respects requested times', async function () {
    const project = await fetchTestProject();
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);

    suggestSchedule(project, { seed: 'schedule' });
    checkMeetingsAgainstTimes(project);

    let { errors: scheduleErrors } = await validateGrid(project);
    scheduleErrors = scheduleErrors.filter(error => error.severity === 'error');
    assert.deepStrictEqual(scheduleErrors, []);
  });

  it('respects requested times regardless of seed', async function () {
    const project = await fetchTestProject();
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);

    suggestSchedule(project, { seed: 'another' });
    checkMeetingsAgainstTimes(project);
  });

  it('reports a validation warning when requested times cannot be respected', async function () {
    const project = await fetchTestProject();
    const session = project.sessions.find(s => s.number === 42);

    // Create an artificial conflict between #42 and #58, with same group.
    // (same time Thursday 17:00 - 18:30 requested)
    session.body = `### Estimate of in-person participants

Less than 15

### Select preferred dates and times (11-15 September)

- [ ] Monday, 09:30 - 11:00
- [ ] Monday, 11:30 - 13:00
- [ ] Monday, 14:30 - 16:30
- [ ] Monday, 17:00 - 18:30
- [ ] Tuesday, 09:30 - 11:00
- [X] Tuesday, 11:30 - 13:00
- [X] Tuesday, 14:30 - 16:30
- [ ] Tuesday, 17:00 - 18:30
- [ ] Thursday, 09:30 - 11:00
- [ ] Thursday, 11:30 - 13:00
- [ ] Thursday, 14:30 - 16:30
- [X] Thursday, 17:00 - 18:30
- [ ] Friday, 09:30 - 11:00
- [ ] Friday, 11:30 - 13:00
- [ ] Friday, 14:30 - 16:30
- [ ] Friday, 17:00 - 18:30

### Other sessions where we should avoid scheduling conflicts (Optional)

_No response_

### Other instructions for meeting planners (Optional)

_No response_

### Discussion channel (Optional)

_No response_

### Agenda for the meeting.

_No response_`;
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(stripDetails(errors) , []);

    suggestSchedule(project, { seed: 'schedule' });

    let { errors: warnings } = await validateGrid(project);
    warnings = warnings.filter(error => error.severity === 'warning' && error.type === 'times');
    assert.deepStrictEqual(stripDetails(warnings), [{
      session: 58,
      severity: 'warning',
      type: 'times',
      messages: [
        'Session not scheduled on Thursday (2023-09-14) at 17:00 - 18:30 as requested'
      ]
    }]);
  });

  it('creates an appropriate HTML page', async function () {
    const project = await fetchTestProject();
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);

    suggestSchedule(project, { seed: 'schedule' });

    const html = await convertProjectToHTML(project);
    await assertSameAsRef(html);
  });
});