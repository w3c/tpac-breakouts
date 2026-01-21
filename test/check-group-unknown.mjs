import { describe, it, before } from 'node:test';
import { initTestEnv } from './init-test-env.mjs';
import { setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { validateSession } from '../tools/common/validate.mjs';
import * as assert from 'node:assert';

describe('Validation of unknown groups', function () {
  before(function () {
    initTestEnv();
    setEnvKey('REPOSITORY', 'test/group-unknown');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-group.yml');
  });

  it('takes mapping into account regardless of type abbreviation (BG -> Business Group)', async function () {
    const project = await loadProject();
    project.w3cIds = { 'The Super Business Group': -1 };
    const sessionNumber = 1;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('takes mapping into account regardless of type abbreviation (BG -> BG)', async function () {
    const project = await loadProject();
    project.w3cIds = { 'The Super BG': 'ok' };
    const sessionNumber = 1;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('takes mapping into account regardless of type abbreviation (Working Group -> Working Group)', async function () {
    const project = await loadProject();
    project.w3cIds = { 'the not heavily working group': 'lazy' };
    const sessionNumber = 2;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('takes mapping into account regardless of type abbreviation (Working Group -> WG)', async function () {
    const project = await loadProject();
    project.w3cIds = { 'the not heavily WG': -1 };
    const sessionNumber = 2;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('is fine with joint meetings that involves an unknown group explicitly approved (using ",")', async function () {
    const project = await loadProject();
    project.w3cIds = { 'WHATWG': 'ok' };
    const sessionNumber = 3;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('is fine with joint meetings that involves an unknown group explicitly approved (using "&")', async function () {
    const project = await loadProject();
    project.w3cIds = { 'WHATWG': 'ok' };
    const sessionNumber = 4;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('is fine with joint meetings that involves an unknown group explicitly approved (using "and")', async function () {
    const project = await loadProject();
    project.w3cIds = { 'WHATWG': 'ok' };
    const sessionNumber = 5;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('reports an error when title of a joint meeting does not have "Joint meeting"', async function () {
    const project = await loadProject();
    project.w3cIds = { 'WHATWG': 'ok' };
    const sessionNumber = 6;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'groups',
      messages: ['Joint meeting found but the title does not have "Joint Meeting"']
    }]);
  });
});