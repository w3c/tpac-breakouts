import { initTestEnv } from './init-test-env.mjs';
import { setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { validateProject } from '../tools/common/project.mjs';
import * as assert from 'node:assert';

describe('Project validation', function () {
  beforeEach(function () {
    initTestEnv();
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
  });

  it('reports about missing meeting and timezone fields', async function () {
    setEnvKey('REPOSITORY', 'test/project-validation-empty');
    const project = await loadProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'The "meeting" info in the short description is missing. Should be something like "meeting: TPAC 2023"',
      'The "timezone" info in the short description is missing. Should be something like "timezone: Europe/Madrid"'
    ]);
  });

  it('reports about an invalid timezone field', async function () {
    setEnvKey('REPOSITORY', 'test/project-validation-timezone');
    const project = await loadProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'The "timezone" info in the short description is not a valid timezone. Value should be a "tz identifier" in https://en.wikipedia.org/wiki/List_of_tz_database_time_zones'
    ]);
  });

  it('reports about an invalid type field', async function () {
    setEnvKey('REPOSITORY', 'test/project-validation-type');
    const project = await loadProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'The "type" info must be one of "groups" or "breakouts"'
    ]);
  });

  it('reports about invalid slots', async function () {
    setEnvKey('REPOSITORY', 'test/project-validation-slots');
    const project = await loadProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'Invalid slot start time "Too early". Format should be "HH:mm"',
      'Invalid slot end time "undefined". Format should be "HH:mm"',
      'Invalid slot start time "11 - 12". Format should be "HH:mm"',
      'Invalid slot end time "undefined". Format should be "HH:mm"',
      'Unexpected slot duration 240. Duration should be between 30 and 120 minutes.'
    ]);
  });

  it('reports about invalid days', async function () {
    setEnvKey('REPOSITORY', 'test/project-validation-days');
    const project = await loadProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'Invalid day name "Soon" in slot. Format should be "YYYY-MM-DD"',
      'Invalid day name "Soon" in slot. Format should be "YYYY-MM-DD"',
      'Invalid day name "Soon" in slot. Format should be "YYYY-MM-DD"',
      'Invalid day name "Soon" in slot. Format should be "YYYY-MM-DD"',
      'Invalid day name "08" in slot. Format should be "YYYY-MM-DD"',
      'Invalid day name "08" in slot. Format should be "YYYY-MM-DD"',
      'Invalid day name "08" in slot. Format should be "YYYY-MM-DD"',
      'Invalid day name "08" in slot. Format should be "YYYY-MM-DD"'
    ]);
  });

  it('reports about missing days for group meetings', async function () {
    setEnvKey('REPOSITORY', 'test/project-validation-groups-days');
    const project = await loadProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'TPAC event days should be a Monday, Tuesday, Thursday and Friday',
      'TPAC events should have 16 slots in total, 12 slots found'
    ]);
  });

  it('reports about missing weekdays for group meetings', async function () {
    setEnvKey('REPOSITORY', 'test/project-validation-groups-weekdays');
    const project = await loadProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'TPAC event days should be a Monday, Tuesday, Thursday and Friday'
    ]);
  });

  it('reports about missing slots for group meetings', async function () {
    setEnvKey('REPOSITORY', 'test/project-validation-groups-slots');
    const project = await loadProject();
    const errors = await validateProject(project);
    assert.deepStrictEqual(errors, [
      'TPAC events should have 16 slots in total, 4 slots found'
    ]);
  });
})