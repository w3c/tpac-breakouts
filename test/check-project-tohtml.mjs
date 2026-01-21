import { describe, it, beforeEach } from 'node:test';
import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { convertProjectToHTML } from '../tools/common/project2html.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import * as assert from 'node:assert';

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

describe('The module that converts a project to HTML', function () {
  beforeEach(function () {
    initTestEnv();
  });

  it('creates the expected page for breakout sessions', async function () {
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
    setEnvKey('REPOSITORY', 'test/session-validation');
    const project = await loadProject();
    const html = await convertProjectToHTML(project);
    await assertSameAsRef(html);
  });

  it('creates the expected page for group meetings', async function () {
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-group.yml');
    setEnvKey('REPOSITORY', 'test/group-meetings');
    const project = await loadProject();
    const html = await convertProjectToHTML(project);
    await assertSameAsRef(html);
  });

  it('creates the expected page for breakouts day 2024', async function () {
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
    setEnvKey('REPOSITORY', 'test/breakouts-day-2024');
    const project = await loadProject();
    const html = await convertProjectToHTML(project);
    await assertSameAsRef(html);
  });

  it('creates the expected page when the reduce option is set', async function () {
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
    setEnvKey('REPOSITORY', 'test/breakouts-day-2024-reduce');
    const project = await loadProject();
    const html = await convertProjectToHTML(project, {
      seed: 12345,
      reduce: true
    });
    await assertSameAsRef(html);
  });
});