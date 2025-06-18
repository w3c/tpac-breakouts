import * as assert from 'node:assert';
import { initTestEnv } from './init-test-env.mjs';
import { setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { validateGrid } from '../tools/common/validate.mjs';
import { convertProjectToHTML } from '../tools/common/project2html.mjs';
import { suggestSchedule } from '../tools/common/schedule.mjs';

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
    setEnvKey('REPOSITORY', 'test/vip-room');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-group.yml');
  });

  it('schedules VIP/non-VIP groups to VIP/non-VIP rooms', async function () {
    const project = await loadProject();
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);

    suggestSchedule(project, { seed: 'schedule' });

    let { errors: scheduleErrors } = await validateGrid(project);
    scheduleErrors = scheduleErrors.filter(error => error.severity === 'error');
    assert.deepStrictEqual(scheduleErrors, []);

    for (const session of project.sessions) {
      if (session.number === 1) {
        assert.strictEqual(session.room, 'Business',
          `VIP group ${session.number} scheduled in non-VIP room ${session.room}`);
      }
      else if (session.slot && session.room) {
        assert.strictEqual(session.room, 'Economy',
          `Non-VIP group ${session.number} scheduled in VIP room ${session.room}`);
      }
    }
  });
});