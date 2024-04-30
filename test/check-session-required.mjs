import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/lib/envkeys.mjs';
import { fetchProject } from '../tools/lib/project.mjs';
import { validateSession } from '../tools/lib/validate.mjs';
import * as assert from 'node:assert';

async function fetchTestProject() {
  return fetchProject(
    await getEnvKey('PROJECT_OWNER'),
    await getEnvKey('PROJECT_NUMBER'));
}

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
    setEnvKey('PROJECT_NUMBER', 'session-required');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-required.yml');
  });

  it('considers that a session is a breakout session by default', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 1;
    const session = project.sessions.find(s => s.number === sessionNumber);
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
    assert.strictEqual(session.description.type, 'breakout');
  });

  it('sets a default capacity when none is given', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 2;
    const session = project.sessions.find(s => s.number === sessionNumber);
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
    assert.strictEqual(session.description.capacity, 0);
  });
});