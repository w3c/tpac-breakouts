import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/node/lib/envkeys.mjs';
import { fetchProject } from '../tools/node/lib/project.mjs';
import { validateProject } from '../tools/common/project.mjs';
import * as assert from 'node:assert';

async function fetchTestProject() {
  return fetchProject(
    await getEnvKey('PROJECT_OWNER'),
    await getEnvKey('PROJECT_NUMBER'));
}

describe('Project validation', function () {
  beforeEach(function () {
    initTestEnv();
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
  });

  it('reports about missing meeting and timezone fields', async function () {
    setEnvKey('PROJECT_NUMBER', 'project-validation-empty');
    const project = await fetchTestProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'The "meeting" info in the short description is missing. Should be something like "meeting: TPAC 2023"',
      'The "timezone" info in the short description is missing. Should be something like "timezone: Europe/Madrid"'
    ]);
  });

  it('reports about an invalid timezone field', async function () {
    setEnvKey('PROJECT_NUMBER', 'project-validation-timezone');
    const project = await fetchTestProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'The "timezone" info in the short description is not a valid timezone. Value should be a "tz identifier" in https://en.wikipedia.org/wiki/List_of_tz_database_time_zones'
    ]);
  });

  it('reports about an invalid type field', async function () {
    setEnvKey('PROJECT_NUMBER', 'project-validation-type');
    const project = await fetchTestProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'The "type" info must be one of "groups" or "breakouts"'
    ]);
  });

  it('reports about invalid slots', async function () {
    setEnvKey('PROJECT_NUMBER', 'project-validation-slots');
    const project = await fetchTestProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'Invalid slot name "Too early". Format should be "HH:mm - HH:mm"',
      'Invalid slot name "11 - 12". Format should be "HH:mm - HH:mm"',
      'Unexpected slot duration 240. Duration should be between 30 and 120 minutes.'
    ]);
  });

  it('reports about invalid days', async function () {
    setEnvKey('PROJECT_NUMBER', 'project-validation-days');
    const project = await fetchTestProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'Invalid day name "Soon". Format should be either "YYYY-MM-DD" or "[label] (YYYY-MM-DD)',
      'Invalid date in day name "2024-14-35".',
      'Invalid day name "Monday (08)". Format should be either "YYYY-MM-DD" or "[label] (YYYY-MM-DD)'
    ]);
  });
})