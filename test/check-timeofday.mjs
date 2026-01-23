import { describe, it, before } from 'node:test';
import { initTestEnv } from './init-test-env.mjs';
import { setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { validateSession, validateGrid } from '../tools/common/validate.mjs';
import { suggestSchedule } from '../tools/common/schedule.mjs';
import * as assert from 'node:assert';

function stripDetails(errors) {
  return errors.map(err => {
    if (err.details) {
      delete err.details;
    }
    return err;
  });
}

describe('Session validation', function () {
  before(function () {
    initTestEnv();
    setEnvKey('REPOSITORY', 'test/session-timeofday');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-timeofday.yml');
  });

  it('validates a session with no preference', async function () {
    const project = await loadProject();
    const sessionNumber = 1;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('validates a morning session scheduled in the morning', async function () {
    const project = await loadProject();
    const sessionNumber = 2;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('validates an afternoon session scheduled in the afternoon', async function () {
    const project = await loadProject();
    const sessionNumber = 3;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('validates an evening session scheduled in the evening', async function () {
    const project = await loadProject();
    const sessionNumber = 4;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('warns when a morning session is scheduled in the afternoon', async function () {
    const project = await loadProject();
    const sessionNumber = 2;
    const session = project.sessions.find(s => s.number === sessionNumber);
    session.slot = '2042-04-05 15:00';
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(stripDetails(errors), [{
      session: sessionNumber,
      severity: 'warning',
      type: 'times',
      messages: [
        'Session scheduled at 15:00 but morning slot requested'
      ]
    }]);
  });

  it('warns when an afternoon session is scheduled in the morning', async function () {
    const project = await loadProject();
    const sessionNumber = 3;
    const session = project.sessions.find(s => s.number === sessionNumber);
    session.slot = '2042-04-05 12:00';
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(stripDetails(errors), [{
      session: sessionNumber,
      severity: 'warning',
      type: 'times',
      messages: [
        'Session scheduled at 12:00 but afternoon slot requested'
      ]
    }]);
  });

  it('warns when an evening session is scheduled in the afternoon', async function () {
    const project = await loadProject();
    const sessionNumber = 4;
    const session = project.sessions.find(s => s.number === sessionNumber);
    session.slot = '2042-04-05 15:00';
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(stripDetails(errors), [{
      session: sessionNumber,
      severity: 'warning',
      type: 'times',
      messages: [
        'Session scheduled at 15:00 but evening slot requested'
      ]
    }]);
  });

  it('schedules a morning session in the morning', async function () {
    const project = await loadProject();
    const sessionNumber = 2;
    const session = project.sessions.find(s => s.number === sessionNumber);
    session.slot = null;
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);
    suggestSchedule(project, { seed: 12345 });
    assert.deepStrictEqual(session.slot, '2042-04-05 10:00');
  });

  it('schedules an afternoon session in the afternoon', async function () {
    const project = await loadProject();
    const sessionNumber = 3;
    const session = project.sessions.find(s => s.number === sessionNumber);
    session.slot = null;
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);
    suggestSchedule(project, { seed: 12345 });
    assert.deepStrictEqual(session.slot, '2042-04-05 13:00');
  });

  it('schedules an evening session in the evening', async function () {
    const project = await loadProject();
    const sessionNumber = 4;
    const session = project.sessions.find(s => s.number === sessionNumber);
    session.slot = null;
    const { errors } = await validateGrid(project);
    assert.deepStrictEqual(errors, []);
    suggestSchedule(project, { seed: 12345 });
    assert.deepStrictEqual(session.slot, '2042-04-05 22:00');
  });
});
