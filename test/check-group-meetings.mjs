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

  it('reports scheduling format issues', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 10;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'meeting format',
      messages: ['Invalid room, day or slot in "Invalid room"']
    }]);
  });

  it('reports missing minutes when a meeting is past', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 11;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'warning',
      type: 'minutes',
      messages: ['Session needs a link to the minutes']
    }]);
  });

  it('reports an error when two sessions are scheduled in the same room at the same time', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 12;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'scheduling',
      messages: ['Session scheduled in same room (Room 2) and same day/slot (Monday (2042-02-10) 9:00 - 11:00) as session "Improving Web Advertising Business Group" (13)']
    }]);
  });

  it('warns about capacity problems', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 14;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'warning',
      type: 'capacity',
      messages: ['Capacity of "Room 1" (30) is lower than requested capacity (50)']
    }]);
  });

  it('reports an error when a group needs to be at two places at once', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 15;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'group conflict',
      messages: ['Session scheduled at the same time as "Audio CG & Audio Description CG joint meeting" (#16), which shares a common group "Audio CG"']
    }]);
  });

  it('warns when conflicting sessions are scheduled at the same time', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 17;
    const errors = await validateSession(sessionNumber, project);
    assert.strictEqual(errors.length, 1, JSON.stringify(errors, null, 2));
    assert.deepStrictEqual(errors[0], {
      session: sessionNumber,
      severity: 'warning',
      type: 'conflict',
      messages: ['Same day/slot "Monday (2042-02-10) 16:00 - 18:00" as conflicting session "Color on the Web Community Group" (#18)']
    });
  });

  it('reports an error when a group is scheduled more than once in the same slot', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 19;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'meeting duplicate',
      messages: ['Scheduled more than once in day/slot Monday (2042-02-10) 9:00 - 11:00']
    }]);
  });

  it('reports an error when two sessions use the same IRC channel at the same time', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 20;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'irc',
      messages: ['Same IRC channel "#debug" as session #21 "Credible Web Community Group"']
    }]);
  });

  it('warns when sessions in same track are scheduled at the same time', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 22;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'warning',
      type: 'track',
      messages: ['Same day/slot "Monday (2042-02-10) 14:00 - 16:00" as session in same track "track: debug": "Generative AI CG" (#23)']
    }]);
  });
});