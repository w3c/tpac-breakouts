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

describe('Session validation', function () {
  before(function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'session-validation');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/session-template-default.yml');
  });

  it('validates a valid session', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 42;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 0);
  });

  it('reports formatting errors', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 1;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'error',
      type: 'format',
      messages: [
        'Missing required section "Session description"',
        'Missing required section "Session goal"',
        'Missing required section "Session type"'
      ]
    });
  });

  it('reports an error when a session conflicts with itself', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 2;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'error',
      type: 'conflict',
      messages: ['Session cannot conflict with itself']
    });
  });

  it('reports an error when a session conflicts with an unknown session', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 3;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'error',
      type: 'conflict',
      messages: ['Conflicting session #424242 is not in the project']
    });
  });

  it('reports an error when a plenary session says it has a conflict', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 4;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'error',
      type: 'conflict',
      messages: ['Plenary session cannot conflict with any other session']
    });
  });

  it('reports an error when a plenary session is not scheduled in plenary room', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 5;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'error',
      type: 'scheduling',
      messages: ['Plenary session must be scheduled in plenary room']
    });
  });

  it('reports an error when a breakout session is scheduled in plenary room', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 6;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'error',
      type: 'scheduling',
      messages: ['Breakout session must not be scheduled in plenary room']
    });
  });

  it('reports an error when two sessions are scheduled in the same room at the same time', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 7;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'error',
      type: 'scheduling',
      messages: ['Session scheduled in same room (Main (25)) and same day/slot (2042-04-05 9:00 - 10:00) as session "Scheduled in same room as previous one" (8)']
    });
  });

  it('reports an error when too many sessions are scheduled in a plenary slot', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 9;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'error',
      type: 'scheduling',
      messages: ['Too many sessions scheduled in same plenary slot']
    });
  });

  it('warns about capacity problems', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 13;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'warning',
      type: 'capacity',
      messages: ['Room capacity is lower than requested capacity']
    });
  });

  it('reports an error when a chair needs to be at two places at once', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 14;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'error',
      type: 'chair conflict',
      messages: ['Same slot as session "Chair common with previous one" (#15), which shares a common chair']
    });
  });

  it('warns when conflicting sessions are scheduled at the same time', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 16;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'warning',
      type: 'conflict',
      messages: ['Same day/slot "2042-04-05 12:00 - 13:00" as conflicting session "Conflicts with previous session scheduled at same time" (#17)']
    });
  });

  it('warns when sessions in same track are scheduled at the same time', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 18;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'warning',
      type: 'track',
      messages: ['Same day/slot "2042-04-05 13:00 - 14:00" as session in same track "track: debug": "Same time as previous session in same track" (#19)']
    });
  });

  it('warns when a breakout session is scheduled at the same time as a plenary', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 20;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'warning',
      type: 'plenary',
      messages: ['Same time/slot "2042-04-05 14:00 - 15:00" as plenary session "Plenary scheduled at same time as previous breakout" (#21)']
    });
  });

  it('reports an error when two sessions use the same IRC channel at the same time', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 22;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'error',
      type: 'irc',
      messages: ['Same IRC channel "#debug" as session #23 "Same IRC channel as previous session"']
    });
  });

  it('informs about instructions for meeting planners', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 24;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'check',
      type: 'instructions',
      messages: ['Session contains instructions for meeting planners']
    });
  });

  it('warns about external minutes', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 25;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'warning',
      type: 'minutes origin',
      messages: ['Minutes not stored on w3.org']
    });
  });

  it('warns about missing minutes', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 26;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'warning',
      type: 'minutes',
      messages: ['Session needs a link to the minutes']
    });
  });

  it('reports an error when chairs are unknown', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 27;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'error',
      type: 'chairs',
      messages: [
        'No W3C account linked to the "@johndoe" GitHub account',
        'No W3C account linked to "Jane Doe"',
        'No W3C account linked to "John Doe"'
      ]
    });
  });
});