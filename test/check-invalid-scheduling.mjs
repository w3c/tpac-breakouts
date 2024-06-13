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

describe('When given invalid sessions, the scheduler', function () {
  before(function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'session-validation');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
  });

  it('skips invalid sessions', async function () {
    const project = await fetchTestProject();
    project.sessions = project.sessions.filter(s => [1, 2, 3].includes(s.number));
    await validateGrid(project);

    const session1 = project.sessions.find(s => s.number === 1);
    const session2 = project.sessions.find(s => s.number === 2);
    const session3 = project.sessions.find(s => s.number === 3);
    session2.blockingError = true;
    suggestSchedule(project, { seed: 'schedule' });

    assert.deepStrictEqual(session1.meetings, undefined);
    assert.deepStrictEqual(session2.meetings, undefined);
    assert.deepStrictEqual(session3.meetings?.length, 1);
  });
});