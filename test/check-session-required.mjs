import { initTestEnv } from './init-test-env.mjs';
import { setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { validateSession } from '../tools/common/validate.mjs';
import * as assert from 'node:assert';

function stripDetails(errors) {
  return errors.map(err => {
    if (err.details) {
      delete err.details;
    }
    return err;
  });
}

describe('Session validation on required select fields', function () {
  before(function () {
    initTestEnv();
    setEnvKey('REPOSITORY', 'test/session-required');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-required.yml');
  });

  it('considers that a session is a breakout session by default', async function () {
    const project = await loadProject();
    const sessionNumber = 1;
    const session = project.sessions.find(s => s.number === sessionNumber);
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
    assert.strictEqual(session.description.type, 'breakout');
  });

  it('sets a default capacity when none is given', async function () {
    const project = await loadProject();
    const sessionNumber = 2;
    const session = project.sessions.find(s => s.number === sessionNumber);
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
    assert.strictEqual(session.description.capacity, 0);
  });
});