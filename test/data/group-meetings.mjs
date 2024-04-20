export default {
  allowMultipleMeetings: true,
  description: 'meeting: Group meetings test event, timezone: Etc/UTC, type: groups',

  days: [
    '2020-02-11',
    'Monday (2042-02-10)',
    'Tuesday (2042-02-11)',
    'Thursday (2042-02-13)',
    'Friday (2042-02-14)'
  ],

  // Various slots to avoid creating artificial conflicts
  slots: [
    '9:00 - 11:00',
    '11:00 - 13:00',
    '14:00 - 16:00',
    '16:00 - 18:00'
  ],

  // A few rooms, including one for plenary sessions
  rooms: [
    'Room 1',
    'Room 2',
    'Room 3',
    'Room 4',
    'Room 5',
    'Room 6'
  ],

  w3cAccounts: {
  },

  sessions: [
    {
      number: 1,
      title: 'Immersive Web WG'
    },

    {
      number: 2,
      title: 'Second Screen WG',
      author: 'whocares'
    },

    {
      number: 3,
      title: 'Fantasy WG'
    },

    {
      number: 4,
      title: 'Second Screen CG'
    },

    {
      number: 5,
      title: 'Second Screen CG'
    },

    {
      number: 6,
      title: 'Web Performance Working Group'
    },

    {
      number: 7,
      title: 'Media WG & Web Real-Time Communications WG joint meeting'
    },

    {
      number: 8,
      title: 'JSON for Linking data CG, Web Of Things WG, RDF Dataset Canonicalization and Hash Working Group Joint meeting'
    },

    {
      number: 9,
      title: 'Web Of Things WG Joint meeting'
    },

    {
      number: 10,
      title: 'WebTransport Working Group',
      meeting: 'Room 1, Monday, 9:00; Invalid room; 2042-02-10; 9:00 - 11:00',
      body: `
### Session description
Invalid room in one of the meetings.`
    },

    {
      number: 11,
      title: 'WebAssembly Working Group',
      meeting: 'Room 1, 2042-02-11, 9:00; Room 1, 2020-02-11, 11:00',
      body: `
### Session description
Scheduled a long time ago, no minutes.`
    },

    {
      number: 12,
      title: 'Publishing BG',
      room: 'Room 2',
      day: 'Monday (2042-02-10)',
      meeting: '9:00; 11:00',
      body: `
### Session description
Scheduled in same room and at the same time as next session.`
    },

    {
      number: 13,
      title: 'Improving Web Advertising Business Group',
      meeting: 'Room 2, Monday, 9:00; Room 3, Monday, 11:00',
      body: `
### Session description
Scheduled in same room and at the same time as previous session.`
    },

    {
      number: 14,
      title: 'Anti-Fraud Community Group',
      body: `
### Session description
Capacity problem.
### Estimated number of in-person attendees
More than 50`,
      meeting: 'Room 1'
    },

    {
      number: 15,
      title: 'Audio Community Group',
      body: `
### Session description
Schedule conflict with next joint meeting.`,
      room: 'Room 3',
      day: 'Monday (2042-02-10)',
      slot: '14:00 - 16:00'
    },

    {
      number: 16,
      title: 'Audio CG & Audio Description CG joint meeting',
      body: `
### Session description
Schedule conflict with previous Audio CG meeting.`,
      meeting: 'Room 4, Monday, 11:00; Room 4, Monday, 14:00'
    },

    {
      number: 17,
      title: 'Cognitive AI CG',
      body: `
### Session description
Conflicts with next session scheduled at same time.
### Other meetings where we should avoid scheduling conflicts (Optional)
#18`,
      meeting: 'Room 1, Monday, 16:00'
    },

    {
      number: 18,
      title: 'Color on the Web Community Group',
      body: `
### Session description
Conflicts with previous session scheduled at same time.`,
      meeting: 'Room 2, Monday, 16:00'
    },

    {
      number: 19,
      title: 'Consent Community Group',
      body: `
### Session description
Incoherent scheduling.`,
      meeting: 'Monday, 9:00; Monday, 11:00; Monday, 9:00 - 11:00'
    },

    {
      number: 20,
      title: 'Credentials Community Group',
      body: `
### Session description
Same IRC channel as next session.
### IRC channel (Optional)
#debug`,
      day: 'Thursday (2042-02-13)',
      slot: '16:00 - 18:00',
      meeting: 'Room 1'
    },

    {
      number: 21,
      title: 'Credible Web Community Group',
      body: `
### Session description
Same IRC channel as previous session.
### IRC channel (Optional)
#debug`,
      meeting: 'Thursday, 16:00'
    },

    {
      number: 22,
      title: 'Games CG',
      labels: ['session', 'track: debug'],
      body: `
### Session description
Same time as next group meeting in same track.`,
      room: 'Room 5',
      meeting: 'Monday, 9:00 | Monday, 11:00 | Monday, 14:00 - 16:00'
    },

    {
      number: 23,
      title: 'Generative AI CG',
      labels: ['session', 'track: debug'],
      body: `
### Session description
Same time as previous group meeting in same track.`,
      day: 'Monday (2042-02-10)',
      slot: '14:00 - 16:00',
      meeting: 'Room 6'
    },

    {
      number: 24,
      title: 'GPU for the Web Community Group',
      body: `
### Session description
Check contiguous slots merge and links to calendar
### Links to calendar (Optional)
- [Tuesday, 9:00 - 18:00](https://example.com/calendar/1)
- [Thursday, 9:00 - 11:00](https://example.com/calendar/2)
- [Thursday, 14:00 - 18:00](https://example.com/calendar/3)
- [Friday, 9:00 - 11:00](https://example.com/calendar/4)
- [Friday, 14:00 - 16:00](https://example.com/calendar/5)
- [Monday, 9:00 - 18:00](https://example.com/calendar/6)`,
      room: 'Room 6',
      meeting: 'Tuesday, 14:00; Tuesday, 11:00; Tuesday, 9:00; Thursday, 9:00; Tuesday, 16:00; Thursday, 16:00; Thursday, 14:00; Friday, 11:00; Friday, 16:00'
    }
  ]
}