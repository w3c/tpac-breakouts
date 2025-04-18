export default {
  title: 'Validation test event',
  metadata: {
    meeting: 'Validation test event',
    timezone: 'Etc/UTC',
    type: 'groups'
  },

  days: [
    '2025-04-07',
    '2025-04-08',
    '2025-04-10',
    '2025-04-11',
  ],

  slots: [
    '9:00-10:30',
    '11:00-12:30',
    '14:00-16:00',
    '16:30-18:00'
  ],

  rooms: [
    'Room 1',
    'Room 2',
    'Room 3'
  ],

  // Long list of sessions, each having some sort of validation issue,
  // except number #42, which is super valid
  sessions: [
    {
      number: 1,
      title: "Accessibility Guidelines WG",
      author: "ianbjacobs",
      body:
`### Total number of slots you would like to schedule

4 slots

### Acceptable slots

- [X] Monday morning 1
- [X] Monday morning 2
- [X] Monday afternoon 1
- [X] Monday afternoon 2
- [X] Tuesday morning 1
- [X] Tuesday morning 2
- [X] Tuesday afternoon 1
- [X] Tuesday afternoon 2
- [X] Thursday morning 1
- [X] Thursday morning 2
- [X] Thursday afternoon 1
- [X] Thursday afternoon 2
- [X] Friday morning 1
- [X] Friday morning 2
- [X] Friday afternoon 1
- [X] Friday afternoon 2
`
    },

    {
      number: 2,
      title: "Second Screen WG",
      author: "ianbjacobs",
      body:
`### Total number of slots you would like to schedule

4 slots

### Acceptable slots

- [ ] Monday morning 1
- [ ] Monday morning 2
- [ ] Monday afternoon 1
- [ ] Monday afternoon 2
- [X] Tuesday morning 1
- [X] Tuesday morning 2
- [X] Tuesday afternoon 1
- [ ] Tuesday afternoon 2
- [ ] Thursday morning 1
- [ ] Thursday morning 2
- [ ] Thursday afternoon 1
- [ ] Thursday afternoon 2
- [ ] Friday morning 1
- [ ] Friday morning 2
- [ ] Friday afternoon 1
- [ ] Friday afternoon 2
`
    }
  ]
};