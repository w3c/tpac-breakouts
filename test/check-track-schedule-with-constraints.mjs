import * as assert from 'node:assert';
import { initTestEnv } from './init-test-env.mjs';
import { setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { validateGrid } from '../tools/common/validate.mjs';
import { suggestSchedule } from '../tools/common/schedule.mjs';

describe('When given track sessions with constraints, the scheduler', function () {
  before(function () {
    initTestEnv();
    setEnvKey('REPOSITORY', 'test/track-schedule-with-constraints');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
  });

  it('priorities the session with time slot constraints', async function () {
    const project = await loadProject();
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);
    const sessionWithoutConflicts = project.sessions.find(s => s.number === 2);
    // The seed actually shuffles the two sessions in the order we need:
    // 1 first, then 2.
    suggestSchedule(project, { seed: 12345 });
    assert.deepStrictEqual(sessionWithoutConflicts.slot, '2042-04-05 10:00');
  });

  it('priorities the session with time slot constraints even when initial order suggests the opposite', async function () {
    const project = await loadProject();
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);
    const sessionWithoutConflicts = project.sessions.find(s => s.number === 2);
    // The seed actually shuffles the two sessions in the order we need:
    // 2 first, then 1.
    suggestSchedule(project, { seed: 1234 });
    assert.deepStrictEqual(sessionWithoutConflicts.slot, '2042-04-05 10:00');
  });
});