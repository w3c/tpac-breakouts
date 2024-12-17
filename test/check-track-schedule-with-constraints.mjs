import * as assert from 'node:assert';
import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/node/lib/envkeys.mjs';
import { fetchProject } from '../tools/node/lib/project.mjs';
import { validateGrid } from '../tools/node/lib/validate.mjs';
import { suggestSchedule } from '../tools/common/schedule.mjs';

async function fetchTestProject() {
  const project = await fetchProject(
    await getEnvKey('PROJECT_OWNER'),
    await getEnvKey('PROJECT_NUMBER'));
  return project;
}

describe('When given track sessions with constraints, the scheduler', function () {
  before(function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'track-schedule-with-constraints');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
  });

  it('priorities the session with time slot constraints', async function () {
    const project = await fetchTestProject();
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);
    const sessionWithoutConflicts = project.sessions.find(s => s.number === 2);
    // Who would have thought? The "good" seed actually shuffles the two
    // sessions in the order we need: 1 first, then 2.
    suggestSchedule(project, { seed: 'good' });
    assert.deepStrictEqual(sessionWithoutConflicts.slot, '10:00 - 11:00');
  });

  it('priorities the session with time slot constraints even when initial order suggests the opposite', async function () {
    const project = await fetchTestProject();
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);
    const sessionWithoutConflicts = project.sessions.find(s => s.number === 2);
    // Who would have thought? The "bad" seed actually shuffles the two
    // sessions in the order we need: 2 first, then 1.
    suggestSchedule(project, { seed: 'bad' });
    assert.deepStrictEqual(sessionWithoutConflicts.slot, '10:00 - 11:00');
  });
});