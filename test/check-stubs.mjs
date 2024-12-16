import { initTestEnv } from './init-test-env.mjs';
import { setEnvKey } from '../tools/node/lib/envkeys.mjs';
import { fetchProject } from '../tools/node/lib/project.mjs';
import { validateProject } from '../tools/common/project.mjs';
import { validateSession } from '../tools/node/lib/validate.mjs';
import * as assert from 'node:assert';

describe('The stubbing mechanism', function () {
  it('works as expected', async function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'single-breakout-session');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');

    const project = await fetchProject('test', 'single-breakout-session');
    assert.strictEqual(project.sessions.length, 1, 'Test data should contain one session');
    assert.strictEqual(project.sessions[0].number, 22, 'Test session should have number 22');
    const errors = await validateSession(22, project);
    assert.deepStrictEqual(errors, []);
  });
});