import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/common/envkeys.mjs';
import { fetchProject } from '../tools/node/lib/project.mjs';
import { convertProjectToHTML } from '../tools/node/lib/project2html.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import * as assert from 'node:assert';

async function fetchTestProject() {
  return fetchProject(
    await getEnvKey('PROJECT_OWNER'),
    await getEnvKey('PROJECT_NUMBER'));
}

async function assertSameAsRef(html) {
  const refName = await getEnvKey('PROJECT_NUMBER');
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
    setEnvKey('PROJECT_NUMBER', 'session-validation');
    const project = await fetchTestProject();
    const html = await convertProjectToHTML(project);
    await assertSameAsRef(html);
  });

  it('creates the expected page for group meetings', async function () {
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-group.yml');
    setEnvKey('PROJECT_NUMBER', 'group-meetings');
    const project = await fetchTestProject();
    const html = await convertProjectToHTML(project);
    await assertSameAsRef(html);
  });

  it('creates the expected page for breakouts day 2024', async function () {
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
    setEnvKey('PROJECT_NUMBER', 'breakouts-day-2024');
    const project = await fetchTestProject();
    const html = await convertProjectToHTML(project);
    await assertSameAsRef(html);
  });

  it('creates the expected page when the reduce option is set', async function () {
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
    setEnvKey('PROJECT_NUMBER', 'breakouts-day-2024-reduce');
    const project = await fetchTestProject();
    const html = await convertProjectToHTML(project, {
      seed: 12345,
      reduce: true
    });
    await assertSameAsRef(html);
  });
});