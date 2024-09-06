import * as assert from 'node:assert';
import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/lib/envkeys.mjs';
import { fetchProject } from '../tools/lib/project.mjs';
import { validateGrid } from '../tools/lib/validate.mjs';
import { suggestSchedule } from '../tools/lib/schedule.mjs';
import { convertProjectToHTML } from '../tools/lib/project2html.mjs';

async function fetchTestProject() {
  const project = await fetchProject(
    await getEnvKey('PROJECT_OWNER'),
    await getEnvKey('PROJECT_NUMBER'));
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

describe('The VIP system', function () {
  before(function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'vip-room');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-group.yml');
  });

  it('schedules VIP/non-VIP groups to VIP/non-VIP rooms', async function () {
    const project = await fetchTestProject();
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);

    suggestSchedule(project, { seed: 'schedule' });

    let { errors: scheduleErrors } = await validateGrid(project);
    scheduleErrors = scheduleErrors.filter(error => error.severity === 'error');
    assert.deepStrictEqual(scheduleErrors, []);

    for (const session of project.sessions) {
      if (session.number === 1) {
        assert.strictEqual(session.room, 'Business (25) (VIP)',
          `VIP group ${session.number} scheduled in non-VIP room ${session.room}`);
      }
      else if (session.slot && session.room) {
        assert.strictEqual(session.room, 'Economy (25)',
          `Non-VIP group ${session.number} scheduled in VIP room ${session.room}`);
      }
    }

    const unscheduled = project.sessions.filter(s => !s.meeting && (!s.room || !s.slot));
    assert.strictEqual(unscheduled.length, 1,
      `Expected one non-scheduled non-VIP group, but got ${unscheduled.length}`);
  });
});