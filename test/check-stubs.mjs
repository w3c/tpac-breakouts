import { describe, it } from 'node:test';
import { initTestEnv } from './init-test-env.mjs';
import { setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { validateProject } from '../tools/common/project.mjs';
import { validateSession } from '../tools/common/validate.mjs';
import * as assert from 'node:assert';

describe('The stubbing mechanism', function () {
  it('works as expected', async function () {
    initTestEnv();
    setEnvKey('REPOSITORY', 'test/single-breakout-session');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');

    const project = await loadProject();
    assert.strictEqual(project.sessions.length, 1, 'Test data should contain one session');
    assert.strictEqual(project.sessions[0].number, 22, 'Test session should have number 22');
    const errors = await validateSession(22, project);
    assert.deepStrictEqual(errors, []);
  });
});