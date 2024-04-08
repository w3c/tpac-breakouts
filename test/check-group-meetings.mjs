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

describe('The group meetings module', function () {
  before(function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'group-meetings');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/group-template.yml');
  });

  it('validates a valid group meeting', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 1;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('does not validate the author of the issue', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 2;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('reports invalid groups', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 3;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'groups',
      messages: ['No W3C group found for "Fantasy WG"']
    }]);
  });

  it('reports groups that have more than one issue', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 4;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'groups',
      messages: ['Another issue #5 found for the "Second Screen CG"']
    }]);
  });

  it('supports group names that use an expanded type', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 6;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('understands joint meetings', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 7;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('understands tripartite joint meetings', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 8;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('reports joint meetings that target only one group', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 9;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'groups',
      messages: ['Group cannot have a joint meeting with itself']
    }]);
  });
});