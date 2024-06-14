import * as assert from 'node:assert';
import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/lib/envkeys.mjs';
import { fetchProject, validateProject } from '../tools/lib/project.mjs';
import { validateSession } from '../tools/lib/validate.mjs';
import { groupSessionMeetings } from '../tools/lib/meetings.mjs';

async function fetchTestProject() {
  return fetchProject(
    await getEnvKey('PROJECT_OWNER'),
    await getEnvKey('PROJECT_NUMBER'));
}

function toGroupNames(groups) {
  return groups ? groups.map(group => group.name) : [];
}

describe('The group meetings highlight code', function () {
  before(function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'group-highlight');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-group.yml');
  });

  it('finds the group name from a title with highlight (":")', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 1;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);

    const session = project.sessions.find(s => s.number === sessionNumber);
    assert.deepStrictEqual(
      toGroupNames(session.groups),
      ['Web Platform Incubator CG']);
  });

  it('finds the group name from a title with highlight (">")', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 4;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);

    const session = project.sessions.find(s => s.number === sessionNumber);
    assert.deepStrictEqual(
      toGroupNames(session.groups),
      ['Second Screen WG']);
  });

  it('does not get confused by a ":" in the group name', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 3;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);

    const session = project.sessions.find(s => s.number === sessionNumber);
    assert.deepStrictEqual(
      toGroupNames(session.groups),
      ['WAI-Engage: Web Accessibility CG']);
  });

  it('finds group names from a joint meeting title with highlight', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 5;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);

    const session = project.sessions.find(s => s.number === sessionNumber);
    assert.deepStrictEqual(
      toGroupNames(session.groups),
      ['Second Screen WG', 'Media WG']);
  });

  it('does not merge meetings when an highlight is used in one of them', async function () {
    const project = await fetchTestProject();
    const errors = await validateProject(project);

    const sessionNumber = 2;
    const session = project.sessions.find(s => s.number === sessionNumber);
    const merged = groupSessionMeetings(session, project);
    assert.deepStrictEqual(merged, [
      {
        start: '9:00',
        end: '11:00',
        room: 'Room 1',
        day: 'Monday (2042-02-10)'
      },
      {
        start: '14:00',
        end: '16:00',
        room: 'Room 1',
        day: 'Monday (2042-02-10)'
      }
    ]);
  });
});