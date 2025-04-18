import * as assert from 'node:assert';
import { initTestEnv } from './init-test-env.mjs';
import { setEnvKey } from '../tools/common/envkeys.mjs';
import { loadProject } from '../tools/node/lib/project.mjs';
import { groupSessionMeetings,
         computeSessionCalendarUpdates,
         parseSessionMeetings,
         serializeSessionMeetings } from '../tools/common/meetings.mjs';

describe('The meeting field parser', function () {
  before(function () {
    initTestEnv();
    setEnvKey('REPOSITORY', 'test/group-meetings');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-group.yml');
  });

  it('parses a regular list of meetings', async function () {
    const project = await loadProject();
    const session = {
      meeting: 'Tuesday, Room 1, 9:00; Room 1, Thursday, 11:00 - 13:00'
    };
    const meetings = parseSessionMeetings(session, project);
    assert.deepStrictEqual(meetings, [
      {
        day: 'Tuesday (2042-02-11)',
        room: 'Room 1',
        slot: '9:00 - 11:00'
      },
      {
        day: 'Thursday (2042-02-13)',
        room: 'Room 1',
        slot: '11:00 - 13:00'
      }
    ]);
  });

  it('serializes a regular list of meetings', async function () {
    const project = await loadProject();
    const meetings = [
      {
        day: 'Tuesday (2042-02-11)',
        room: 'Room 1',
        slot: '9:00 - 11:00'
      },
      {
        day: 'Thursday (2042-02-13)',
        room: 'Room 2',
        slot: '11:00 - 13:00'
      }
    ];
    assert.deepStrictEqual(serializeSessionMeetings(meetings, project), {
      meeting: 'Tuesday, 9:00, Room 1; Thursday, 11:00, Room 2'
    });
  });

  it('parses a list of meetings with custom start/end times', async function () {
    const project = await loadProject();
    const session = { meeting: '9:00<8:30> - 11:00<10:30>' };
    const meetings = parseSessionMeetings(session, project);
    assert.deepStrictEqual(meetings, [
      {
        slot: '9:00 - 11:00',
        actualStart: '8:30',
        actualEnd: '10:30'
      }
    ]);
  });

  it('serializes a list of meetings with custom start/end times', async function () {
    const project = await loadProject();
    const meetings = [
      {
        slot: '9:00 - 11:00',
        actualStart: '8:30'
      },
      {
        slot: '11:00 - 13:00',
        actualEnd: '12:30'
      }
    ];
    assert.deepStrictEqual(serializeSessionMeetings(meetings, project), {
      meeting: '9:00<8:30>; 11:00 - 13:00<12:30>'
    });
  });

  it('validates a meeting with custom start/end times within the slot', async function () {
    const project = await loadProject();
    const session = { meeting: '11:00<11:15> - 13:00<12:30>' };
    const meetings = parseSessionMeetings(session, project);
    assert.deepStrictEqual(serializeSessionMeetings(meetings, project), session);
  });

  it('validates an early morning meeting', async function () {
    const project = await loadProject();
    const session = { meeting: '9:00<07:00>' };
    const meetings = parseSessionMeetings(session, project);
    assert.deepStrictEqual(serializeSessionMeetings(meetings, project), session);
  });

  it('validates a late evening meeting', async function () {
    const project = await loadProject();
    const session = { meeting: '16:00 - 18:00<19:00>' };
    const meetings = parseSessionMeetings(session, project);
    assert.deepStrictEqual(serializeSessionMeetings(meetings, project), session);
  });

  it('rejects a meeting with a custom start time that overlaps with former slot', async function () {
    const project = await loadProject();
    const session = { meeting: '11:00<10:30>' };
    const meetings = parseSessionMeetings(session, project);
    assert.deepStrictEqual(meetings, [
      { invalid: '11:00<10:30>' }
    ]);
  });

  it('rejects a meeting with a custom end time that overlaps with next slot', async function () {
    const project = await loadProject();
    const session = { meeting: '11:00 - 13:00<16:30>' };
    const meetings = parseSessionMeetings(session, project);
    assert.deepStrictEqual(meetings, [
      { invalid: '11:00 - 13:00<16:30>' }
    ]);
  });

  it('rejects a meeting with a custom start time that makes no sense', async function () {
    const project = await loadProject();
    const session = { meeting: '11:00<14:30>' };
    const meetings = parseSessionMeetings(session, project);
    assert.deepStrictEqual(meetings, [
      { invalid: '11:00<14:30>' }
    ]);
  });

  it('rejects a meeting with a custom end time that makes no sense', async function () {
    const project = await loadProject();
    const session = { meeting: '9:00 - 11:00<8:30>' };
    const meetings = parseSessionMeetings(session, project);
    assert.deepStrictEqual(meetings, [
      { invalid: '9:00 - 11:00<8:30>' }
    ]);
  });

  it('rejects a meeting with custom start/end times that make no sense', async function () {
    const project = await loadProject();
    const session = { meeting: '9:00<10:30> - 11:00<9:30>' };
    const meetings = parseSessionMeetings(session, project);
    assert.deepStrictEqual(meetings, [
      { invalid: '9:00<10:30> - 11:00<9:30>' }
    ]);
  });

  it('rejects a meeting with custom start/end times that do not change anything', async function () {
    const project = await loadProject();
    const session = { meeting: '9:00<9:00> - 11:00<11:00>' };
    const meetings = parseSessionMeetings(session, project);
    assert.deepStrictEqual(meetings, [
      { invalid: '9:00<9:00> - 11:00<11:00>' }
    ]);
  });

  it('uses custom start/end times when it merges contiguous slots', async function () {
    const project = await loadProject();
    const session = {
      room: 'Room 1',
      day: 'Monday (2042-02-10)',
      meeting: '9:00<8:30>; 11:00; 14:00 - 16:00<15:30>'
    };
    const merged = groupSessionMeetings(session, project);
    assert.deepStrictEqual(merged, [
      {
        room: 'Room 1',
        day: 'Monday (2042-02-10)',
        start: '8:30',
        end: '15:30'
      }
    ]);
  });
});