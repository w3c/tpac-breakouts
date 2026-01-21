import { describe, it, before } from 'node:test';
import * as assert from 'node:assert';
import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { validateProject } from '../tools/common/project.mjs';
import { validateSession } from '../tools/common/validate.mjs';
import { groupSessionMeetings } from '../tools/common/meetings.mjs';
import { convertProjectToHTML } from '../tools/common/project2html.mjs';
import { readFile, writeFile } from 'node:fs/promises';

function toGroupNames(groups) {
  return groups ? groups.map(group => group.name) : [];
}

async function assertSameAsRef(html) {
  const refName = (await getEnvKey('REPOSITORY')).replace(/^test\//, '');
  const refFilename = `test/data/ref-${refName}.html`;
  const updateRef = await getEnvKey('UPDATE_REFS', false);
  if (updateRef) {
    await writeFile(refFilename, html, 'utf8');
  }
  const refHtml = (await readFile(refFilename, 'utf8'))
    .replace(/\r/g, '');
  assert.strictEqual(html, refHtml);
}

describe('The group meetings highlight code', function () {
  before(function () {
    initTestEnv();
    setEnvKey('REPOSITORY', 'test/group-highlight');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-group.yml');
  });

  it('finds the group name from a title with highlight (":")', async function () {
    const project = await loadProject();
    const sessionNumber = 1;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);

    const session = project.sessions.find(s => s.number === sessionNumber);
    assert.deepStrictEqual(
      toGroupNames(session.groups),
      ['Web Platform Incubator CG']);
  });

  it('finds the group name from a title with highlight (">")', async function () {
    const project = await loadProject();
    const sessionNumber = 4;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);

    const session = project.sessions.find(s => s.number === sessionNumber);
    assert.deepStrictEqual(
      toGroupNames(session.groups),
      ['Second Screen WG']);
  });

  it('does not get confused by a ":" in the group name', async function () {
    const project = await loadProject();
    const sessionNumber = 3;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);

    const session = project.sessions.find(s => s.number === sessionNumber);
    assert.deepStrictEqual(
      toGroupNames(session.groups),
      ['WAI-Engage: Web Accessibility CG']);
  });

  it('finds group names from a joint meeting title with highlight', async function () {
    const project = await loadProject();
    const sessionNumber = 5;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);

    const session = project.sessions.find(s => s.number === sessionNumber);
    assert.deepStrictEqual(
      toGroupNames(session.groups),
      ['Second Screen WG', 'Media WG']);
  });

  it('reports an error when meeting is only an highlight', async function () {
    const project = await loadProject();
    const sessionNumber = 6;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: 6,
      severity: 'error',
      type: 'groups',
      messages: [
        'No group associated with the issue'
      ]
    }]);
  });

  it('finds group names even when no acronym is used', async function () {
    const project = await loadProject();
    const sessionNumber = 7;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);

    const session = project.sessions.find(s => s.number === sessionNumber);
    assert.deepStrictEqual(
      toGroupNames(session.groups),
      ['Web Payments WG']);
  });

  it('does not merge meetings when an highlight is used in one of them', async function () {
    const project = await loadProject();
    const errors = await validateProject(project);

    const sessionNumber = 2;
    const session = project.sessions.find(s => s.number === sessionNumber);
    const merged = groupSessionMeetings(session, project);
    assert.deepStrictEqual(merged, [
      {
        start: '9:00',
        end: '11:00',
        room: 'Room 1',
        day: '2042-02-10'
      },
      {
        start: '14:00',
        end: '16:00',
        room: 'Room 1',
        day: '2042-02-10'
      }
    ]);
  });

  it('reports highlights in the group view in the generated HTML page', async function () {
    const project = await loadProject();
    const html = await convertProjectToHTML(project);
    await assertSameAsRef(html);
  });
});