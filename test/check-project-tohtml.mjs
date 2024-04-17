import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/lib/envkeys.mjs';
import { fetchProject } from '../tools/lib/project.mjs';
import { convertProjectToHTML } from '../tools/lib/project2html.mjs';
import { readFile } from 'node:fs/promises';
import * as assert from 'node:assert';

async function fetchTestProject() {
  return fetchProject(
    await getEnvKey('PROJECT_OWNER'),
    await getEnvKey('PROJECT_NUMBER'));
}

async function getRefHtml(name) {
  if (!name) {
    name = await getEnvKey('PROJECT_NUMBER');
  }
  return (await readFile(`test/data/ref-${name}.html`, 'utf8'))
    .replace(/\r/g, '');
}

describe('The module that converts a project to HTML', function () {
  beforeEach(function () {
    initTestEnv();
  });

  it('creates the expected page for breakout sessions', async function () {
    setEnvKey('ISSUE_TEMPLATE', 'test/data/session-template-default.yml');
    setEnvKey('PROJECT_NUMBER', 'session-validation');
    const project = await fetchTestProject();
    const ref = await getRefHtml();
    const html = await convertProjectToHTML(project);
    assert.strictEqual(html, ref);
    //console.log(html);
  });

  it('creates the expected page for group meetings', async function () {
    setEnvKey('ISSUE_TEMPLATE', 'test/data/group-template.yml');
    setEnvKey('PROJECT_NUMBER', 'group-meetings');
    const project = await fetchTestProject();
    const ref = await getRefHtml();
    const html = await convertProjectToHTML(project);
    assert.strictEqual(html, ref);
    //console.log(html);
  });

  it('creates the expected page for breakouts day 2024', async function () {
    setEnvKey('ISSUE_TEMPLATE', 'test/data/session-template-default.yml');
    setEnvKey('PROJECT_NUMBER', 'breakouts-day-2024');
    const project = await fetchTestProject();
    const ref = await getRefHtml();
    const html = await convertProjectToHTML(project);
    assert.strictEqual(html, ref);
    //console.log(html);
  });
});