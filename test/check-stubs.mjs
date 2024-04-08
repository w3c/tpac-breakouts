import { initTestEnv } from './init-test-env.mjs';
import { setEnvKey } from '../tools/lib/envkeys.mjs';
import { fetchProject, validateProject } from '../tools/lib/project.mjs';
import { validateSession } from '../tools/lib/validate.mjs';
import * as assert from 'node:assert';

describe('The stubbing mechanism', function () {
  it('works as expected', async function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'single-breakout-session');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/session-template-default.yml');

    const project = await fetchProject('test', 'single-breakout-session');
    assert.strictEqual(project.sessions.length, 1, 'Test data should contain one session');
    assert.strictEqual(project.sessions[0].number, 22, 'Test session should have number 22');
    const errors = await validateSession(22, project);
    assert.strictEqual(errors.length, 0, 'Test session should validate');
  });
});