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

describe('Validation of unknown groups', function () {
  before(function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'group-unknown');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-group.yml');
  });

  it('takes mapping into account regardless of type abbreviation (BG -> Business Group)', async function () {
    const project = await fetchTestProject();
    project.chairsToW3CID = { 'The Super Business Group': -1 };
    const sessionNumber = 1;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('takes mapping into account regardless of type abbreviation (BG -> BG)', async function () {
    const project = await fetchTestProject();
    project.chairsToW3CID = { 'The Super BG': 'ok' };
    const sessionNumber = 1;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('takes mapping into account regardless of type abbreviation (Working Group -> Working Group)', async function () {
    const project = await fetchTestProject();
    project.chairsToW3CID = { 'the not heavily working group': 'lazy' };
    const sessionNumber = 2;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('takes mapping into account regardless of type abbreviation (Working Group -> WG)', async function () {
    const project = await fetchTestProject();
    project.chairsToW3CID = { 'the not heavily WG': -1 };
    const sessionNumber = 2;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });
});