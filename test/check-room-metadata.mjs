import * as assert from 'node:assert';
import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/lib/envkeys.mjs';
import { fetchProject } from '../tools/lib/project.mjs';

async function fetchTestProject() {
  const project = await fetchProject(
    await getEnvKey('PROJECT_OWNER'),
    await getEnvKey('PROJECT_NUMBER'));
  return project;
}

function assertRoom(project, name, metadata) {
  const room = project.rooms.find(r => r.name === name);
  assert.ok(room, `Room "${name}" not found in project`);
  const roomCopy = Object.assign({}, room);
  if (roomCopy.id) {
    delete roomCopy.id;
  }
  const metadataCopy = Object.assign({}, metadata);
  metadataCopy.name = metadata.name ?? name;
  assert.deepStrictEqual(roomCopy, metadataCopy);
}

describe('The room definition', function () {
  before(function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'room-metadata');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-breakout.yml');
  });

  it('may be just a name', async function () {
    const project = await fetchTestProject();
    const name = 'Just a room';
    assertRoom(project, name, {
      label: name,
      location: '',
      capacity: 30,
      vip: false
    });
  });

  it('may inline room information in the name', async function () {
    const project = await fetchTestProject();
    const name = 'Inline (75 - basement) (VIP)';
    assertRoom(project, name, {
      label: 'Inline',
      capacity: 75,
      location: 'basement',
      vip: true
    });
  });

  it('may contain VIP info in the description', async function () {
    const project = await fetchTestProject();
    const name = 'VIP room';
    assertRoom(project, name, {
      label: name,
      location: '',
      capacity: 25,
      vip: true
    });
  });

  it('may contain additional metadata in the description', async function () {
    const project = await fetchTestProject();
    const name = 'In the back';
    assertRoom(project, name, {
      label: name,
      location: '2nd floor',
      capacity: 40,
      vip: false,
      type: 'backroom'
    });
  });

  it('may contain invalid metadata in the description', async function () {
    const project = await fetchTestProject();
    const name = 'Weird';
    assertRoom(project, name, {
      label: name,
      location: 'somewhere',
      capacity: 30,
      vip: false
    });
  });

  it('may define metadata inline and in the description', async function () {
    const project = await fetchTestProject();
    const name = 'Hybrid (42)';
    assertRoom(project, name, {
      label: 'Hybrid',
      location: 'on ze web',
      capacity: 42,
      vip: false
    });
  });
});