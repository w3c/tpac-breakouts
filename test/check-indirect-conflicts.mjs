import { describe, it, before } from 'node:test';
import * as assert from 'node:assert';
import { initTestEnv } from './init-test-env.mjs';
import { setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { validateSession } from '../tools/common/validate.mjs';

function stripDetails(errors) {
  return errors.map(err => {
    if (err.details) {
      delete err.details;
    }
    return err;
  });
}

describe('Joint meeting handling', function () {
  before(function () {
    initTestEnv();
    setEnvKey('REPOSITORY', 'test/conflicts-indirect');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-group.yml');
  });

  it('detects indirect conflicts', async function () {
    const project = await loadProject();
    const sessionNumber = 4;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(stripDetails(errors), [{
      session: sessionNumber,
      severity: 'warning',
      type: 'conflict',
      messages: ['Same day/slot "2042-02-10 11:00" as conflicting session "Media WG & Web Real-Time Communications WG joint meeting" (#3)']
    }]);
  });

  it('detects indirect conflicts for joint meetings', async function () {
    const project = await loadProject();
    const sessionNumber = 5;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(stripDetails(errors), [{
      session: sessionNumber,
      severity: 'warning',
      type: 'conflict',
      messages: ['Same day/slot "2042-02-10 9:00" as conflicting session "Media WG" (#1)']
    }]);
  });
});