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

describe('Slots validation', function () {
  before(function () {
    initTestEnv();
    setEnvKey('REPOSITORY', 'test/slots-validation');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-tpac2025.yml');
  });

  it('validates a valid session', async function () {
    const project = await loadProject();
    const sessionNumber = 1;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 0);
  });

  it('reports when not enough acceptable slots got selected', async function () {
    const project = await loadProject();
    const sessionNumber = 2;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(stripDetails(errors), [{
      session: sessionNumber,
      severity: 'error',
      type: 'times',
      messages: [
        '4 slots requested but only 3 acceptable slots selected'
      ]
    }]);
  });
});