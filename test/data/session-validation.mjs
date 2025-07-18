export default {
  metadata: {
    meeting: 'Validation test event',
    timezone: 'Etc/UTC',
    'plenary holds': '3'
  },

  // Event scheduled in the past... and in the future
  // Various slots to avoid creating artificial conflicts
  slots: [
    '2020-02-11 9:00 - 10:00',
    '2020-02-11 10:00 - 11:00',
    '2020-02-11 11:00 - 12:00',
    '2020-02-11 12:00 - 13:00',
    '2020-02-11 13:00 - 14:00',
    '2020-02-11 14:00 - 15:00',
    '2020-02-11 15:00 - 16:00',
    '2020-02-11 22:00 - 23:00',
    '2042-04-05 9:00 - 10:00',
    '2042-04-05 10:00 - 11:00',
    '2042-04-05 11:00 - 12:00',
    '2042-04-05 12:00 - 13:00',
    '2042-04-05 13:00 - 14:00',
    '2042-04-05 14:00 - 15:00',
    '2042-04-05 15:00 - 16:00',
    '2042-04-05 22:00 - 23:00'
  ],

  // A few rooms, including one for plenary sessions
  rooms: [
    'Main (25)',
    'Secondary',
    'Plenary'
  ],

  // Specify associations with W3C accounts
  w3cAccounts: {
    testbot: 4242,
    tidoust: 45538,
    ianbjacobs: 78996,
    someone: 11111,
    anyone: 99999
  },

  // Long list of sessions, each having some sort of validation issue,
  // except number #42, which is super valid
  sessions: [
    {
      number: 42,
      title: 'Valid and groovy',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)
### Estimated number of in-person attendees
fewer than 20 people`,
      room: 'Main',
      slot: '2042-04-05 22:00'
    },

    {
      number: 1,
      title: 'Empty issue'
    },

    {
      number: 2,
      title: 'Conflicts with itself',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)
### Other sessions where we should avoid scheduling conflicts (Optional)
#2`
    },

    {
      number: 3,
      title: 'Conflicts with an unknown issue',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)
### Other sessions where we should avoid scheduling conflicts (Optional)
#424242`
    },

    {
      number: 4,
      title: 'Plenary issue with a conflict',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Plenary
### Other sessions where we should avoid scheduling conflicts (Optional)
#1`
    },

    {
      number: 5,
      title: 'Plenary session scheduled in non plenary room',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Plenary`,
      room: 'Main'
    },

    {
      number: 6,
      title: 'Breakout session scheduled in plenary room',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)`,
      room: 'Plenary'
    },

    {
      number: 7,
      title: 'Scheduled in same room as next one',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)`,
      room: 'Main',
      slot: '2042-04-05 9:00'
    },

    {
      number: 8,
      title: 'Scheduled in same room as previous one',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)`,
      room: 'Main',
      slot: '2042-04-05 9:00'
    },

    {
      number: 9,
      title: 'First plenary session',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Plenary`,
      room: 'Plenary',
      slot: '2042-04-05 10:00'
    },

    {
      number: 10,
      title: 'Second plenary session',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Plenary`,
      room: 'Plenary',
      slot: '2042-04-05 10:00'
    },

    {
      number: 11,
      title: 'Third plenary session',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Plenary`,
      room: 'Plenary',
      slot: '2042-04-05 10:00'
    },

    {
      number: 12,
      title: 'Fourth plenary session',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Plenary`,
      room: 'Plenary',
      slot: '2042-04-05 10:00'
    },

    {
      number: 13,
      title: 'Capacity problem',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)
### Estimated number of in-person attendees
More than 45 people`,
      room: 'Main',
      slot: '2042-04-05 15:00'
    },

    {
      number: 14,
      title: 'Chair common with next one',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)
### Additional session chairs
@tidoust`,
      room: 'Main',
      slot: '2042-04-05 11:00'
    },

    {
      number: 15,
      title: 'Chair common with previous one',
      author: 'tidoust',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)`,
      room: 'Secondary',
      slot: '2042-04-05 11:00'
    },

    {
      number: 16,
      title: 'Conflicts with next session scheduled at same time',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)
### Other sessions where we should avoid scheduling conflicts (Optional)
#17`,
      slot: '2042-04-05 12:00'
    },

    {
      number: 17,
      title: 'Conflicts with previous session scheduled at same time',
      author: 'ianbjacobs',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)`,
      slot: '2042-04-05 12:00'
    },

    {
      number: 18,
      title: 'Same time as next session in same track',
      tracks: ['debug'],
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)`,
      room: 'Main',
      slot: '2042-04-05 13:00'
    },

    {
      number: 19,
      title: 'Same time as previous session in same track',
      tracks: ['debug'],
      author: 'tidoust',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)`,
      room: 'Secondary',
      slot: '2042-04-05 13:00'
    },

    {
      number: 20,
      title: 'Breakout scheduled at same time as next plenary',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)`,
      room: 'Main',
      slot: '2042-04-05 14:00'
    },

    {
      number: 21,
      title: 'Plenary scheduled at same time as previous breakout',
      author: 'tidoust',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Plenary`,
      room: 'Plenary',
      slot: '2042-04-05 14:00'
    },

    {
      number: 22,
      title: 'Same IRC channel as next session',
      author: 'someone',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)
### IRC channel (Optional)
#debug`,
      slot: '2042-04-05 15:00'
    },

    {
      number: 23,
      title: 'Same IRC channel as previous session',
      author: 'anyone',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)
### IRC channel (Optional)
#debug`,
      slot: '2042-04-05 15:00'
    },

    {
      number: 24,
      title: 'Comes with instructions',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)
### Instructions for meeting planners (Optional)
You're full of bugs!`,
    },

    {
      number: 25,
      title: 'Has external minutes',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)
### Meeting materials (Optional)
- [minutes](https://example.org/)`,
    },

    {
      number: 26,
      title: 'Lacks minutes',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)`,
      room: 'Main',
      slot: '2020-02-11 9:00'
    },

    {
      number: 27,
      title: 'Unknown chairs',
      author: 'johndoe',
      body: `
### Session description
My session is rich.
### Session goal
Uncover bugs.
### Session type
Breakout (Default)
### Additional session chairs
Jane Doe, John Doe`
    }
  ]
};