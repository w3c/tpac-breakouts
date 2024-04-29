import * as assert from 'node:assert';
import { initTestEnv } from './init-test-env.mjs';
import { getEnvKey, setEnvKey } from '../tools/lib/envkeys.mjs';
import { fetchProject } from '../tools/lib/project.mjs';
import { validateSession } from '../tools/lib/validate.mjs';
import { groupSessionMeetings,
         computeSessionCalendarUpdates,
         parseSessionMeetings,
         parseMeetingsChanges,
         serializeSessionMeetings,
         applyMeetingsChanges } from '../tools/lib/meetings.mjs';

async function fetchTestProject() {
  return fetchProject(
    await getEnvKey('PROJECT_OWNER'),
    await getEnvKey('PROJECT_NUMBER'));
}

function stripDetails(errors) {
  return errors.map(err => {
    if (err.details) {
      delete err.details;
    }
    return err;
  });
}

describe('The group meetings module', function () {
  before(function () {
    initTestEnv();
    setEnvKey('PROJECT_NUMBER', 'group-meetings');
    setEnvKey('ISSUE_TEMPLATE', 'test/data/template-group.yml');
  });

  it('validates a valid group meeting', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 1;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('does not validate the author of the issue', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 2;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('reports invalid groups', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 3;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'groups',
      messages: ['No W3C group found for "Fantasy WG"']
    }]);
  });

  it('reports groups that have more than one issue', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 4;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'groups',
      messages: ['Another issue #5 found for the "Second Screen CG"']
    }]);
  });

  it('supports group names that use an expanded type', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 6;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('understands joint meetings', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 7;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('understands tripartite joint meetings', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 8;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('reports joint meetings that target only one group', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 9;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'groups',
      messages: ['Group cannot have a joint meeting with itself']
    }]);
  });

  it('reports scheduling format issues', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 10;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'meeting format',
      messages: ['Invalid room, day or slot in "Invalid room"']
    }]);
  });

  it('does not report missing minutes when a meeting is past', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 11;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);
  });

  it('reports an error when two sessions are scheduled in the same room at the same time', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 12;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(stripDetails(errors), [{
      session: sessionNumber,
      severity: 'error',
      type: 'scheduling',
      messages: ['Session scheduled in same room (Room 2) and same day/slot (Monday (2042-02-10) 9:00 - 11:00) as session "Improving Web Advertising Business Group" (13)']
    }]);
  });

  it('warns about capacity problems', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 14;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(stripDetails(errors), [{
      session: sessionNumber,
      severity: 'warning',
      type: 'capacity',
      messages: ['Capacity of "Room 1" (30) is lower than requested capacity (50)']
    }]);
  });

  it('reports an error when a group needs to be at two places at once', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 15;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(stripDetails(errors), [{
      session: sessionNumber,
      severity: 'error',
      type: 'group conflict',
      messages: ['Session scheduled at the same time as "Audio CG & Audio Description CG joint meeting" (#16), which shares group Audio CG']
    }]);
  });

  it('warns when conflicting sessions are scheduled at the same time', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 17;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(stripDetails(errors), [{
      session: sessionNumber,
      severity: 'warning',
      type: 'conflict',
      messages: ['Same day/slot "Monday (2042-02-10) 16:00 - 18:00" as conflicting session "Color on the Web Community Group" (#18)']
    }]);
  });

  it('reports an error when a group is scheduled more than once in the same slot', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 19;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(stripDetails(errors), [{
      session: sessionNumber,
      severity: 'error',
      type: 'meeting duplicate',
      messages: ['Scheduled more than once in day/slot Monday (2042-02-10) 9:00 - 11:00']
    }]);
  });

  it('reports an error when two sessions use the same IRC channel at the same time', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 20;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, [{
      session: sessionNumber,
      severity: 'error',
      type: 'irc',
      messages: ['Same IRC channel "#debug" as session #21 "Credible Web Community Group"']
    }]);
  });

  it('warns when sessions in same track are scheduled at the same time', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 22;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(stripDetails(errors), [{
      session: sessionNumber,
      severity: 'warning',
      type: 'track',
      messages: ['Same day/slot "Monday (2042-02-10) 14:00 - 16:00" as session in same track "track: debug": "Generative AI CG" (#23)']
    }]);
  });

  it('parses and serializes meetings', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 11;
    await validateSession(sessionNumber, project);
    const session = project.sessions.find(s => s.number === sessionNumber);
    const meetings = parseSessionMeetings(session, project);
    const meetingsSerialized = serializeSessionMeetings(meetings, project);
    assert.deepStrictEqual(meetingsSerialized, {
      room: 'Room 1',
      meeting: 'Tuesday, 9:00; 2020-02-11, 11:00'
    });
  });

  it('merges contiguous slots for calendaring purpose', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 24;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);

    const session = project.sessions.find(s => s.number === sessionNumber);
    const merged = groupSessionMeetings(session, project);
    assert.deepStrictEqual(merged, [
      // One meeting on Tuesday that spans all four slots
      {
        start: '9:00',
        end: '18:00',
        room: 'Room 6',
        day: 'Tuesday (2042-02-11)'
      },
      // Two meetings on Thursday
      // (one slot in the morning, two slots in the afternoon)
      {
        start: '9:00',
        end: '11:00',
        room: 'Room 6',
        day: 'Thursday (2042-02-13)'
      },
      {
        start: '14:00',
        end: '18:00',
        room: 'Room 6',
        day: 'Thursday (2042-02-13)'
      },
      // Two disconnected meetings on Friday
      {
        start: '11:00',
        end: '13:00',
        room: 'Room 6',
        day: 'Friday (2042-02-14)'
      },
      {
        start: '16:00',
        end: '18:00',
        room: 'Room 6',
        day: 'Friday (2042-02-14)'
      }
    ]);
  });

  it('computes calendar sync update actions', async function () {
    const project = await fetchTestProject();
    const sessionNumber = 24;
    const errors = await validateSession(sessionNumber, project);
    assert.deepStrictEqual(errors, []);

    const session = project.sessions.find(s => s.number === sessionNumber);
    const actions = computeSessionCalendarUpdates(session, project);
    assert.deepStrictEqual(actions, {
      create: [],
      update: [
        {
          day: 'Tuesday (2042-02-11)',
          start: '9:00',
          end: '18:00',
          url: 'https://example.com/calendar/1',
          meeting: {
            room: 'Room 6',
            day: 'Tuesday (2042-02-11)',
            start: '9:00',
            end: '18:00'
          }
        },
        {
          day: 'Thursday (2042-02-13)',
          start: '9:00',
          end: '11:00',
          url: 'https://example.com/calendar/2',
          meeting: {
            room: 'Room 6',
            day: 'Thursday (2042-02-13)',
            start: '9:00',
            end: '11:00'
          }
        },
        {
          day: 'Thursday (2042-02-13)',
          start: '14:00',
          end: '18:00',
          url: 'https://example.com/calendar/3',
          meeting: {
            room: 'Room 6',
            day: 'Thursday (2042-02-13)',
            start: '14:00',
            end: '18:00'
          }
        },
        // The last two ones are "new" calendar entries... that reuse existing
        // calendar entries that are no longer needed!
        {
          day: 'Friday (2042-02-14)',
          start: '16:00',
          end: '18:00',
          meeting: {
            room: 'Room 6',
            day: 'Friday (2042-02-14)',
            start: '16:00',
            end: '18:00'
          },
          url: 'https://example.com/calendar/4'
        },
        {
          day: 'Friday (2042-02-14)',
          start: '11:00',
          end: '13:00',
          meeting: {
            room: 'Room 6',
            day: 'Friday (2042-02-14)',
            start: '11:00',
            end: '13:00'
          },
          url: 'https://example.com/calendar/5'
        }
      ],
      cancel: [
        {
          day: 'Monday (2042-02-10)',
          start: '9:00',
          end: '18:00',
          url: 'https://example.com/calendar/6'
        }
      ]
    });
  });

  it('parses a YAML file that describes meeting changes', function () {
    const changes = parseMeetingsChanges(`
      1:
        reset:
          - day
          - slot
        day: 2024-03-12
        room: Room 5
        meeting:
          - Monday
          - Tuesday
      2:
        reset: all
        room: Room 1
      3:
        reset: day
    `);
    assert.deepStrictEqual(changes, [
      {
        number: 1,
        reset: ['day', 'slot'],
        day: '2024-03-12',
        room: 'Room 5',
        meeting: 'Monday; Tuesday'
      },
      {
        number: 2,
        reset: ['room', 'day', 'slot', 'meeting'],
        room: 'Room 1'
      },
      {
        number: 3,
        reset: ['day']
      }
    ]);
  });

  it('can apply a list of meetings changes', function () {
    const sessions = [
      { number: 1, day: '2024-01-01', room: 'Room 1' },
      { number: 2, meeting: 'Monday; Tuesday' },
      { number: 3 },
      { number: 4 }
    ];

    const changes = [
      {
        number: 1,
        reset: ['day', 'slot'],
        slot: '11:00-13:00',
        meeting: 'Monday; Tuesday'
      },
      {
        number: 2,
        reset: ['room', 'day', 'slot', 'meeting'],
        room: 'Room 1'
      },
      {
        number: 3,
        reset: ['day']
      }
    ];

    applyMeetingsChanges(sessions, changes);
    assert.deepStrictEqual(sessions, [
      { number: 1, updated: true,
        room: 'Room 1', slot: '11:00-13:00', meeting: 'Monday; Tuesday' },
      { number: 2, updated: true,
        room: 'Room 1' },
      { number: 3 },
      { number: 4 }
    ]);
  });
});