export default {
  title: 'Validation test event',
  metadata: {
    meeting: 'Validation test event',
    timezone: 'Etc/UTC',
    type: 'groups'
  },

  slots: [
    '2025-04-07 9:00-10:30',
    '2025-04-07 11:00-12:30',
    '2025-04-07 13:45-15:00',
    '2025-04-07 15:30-16:45',
    '2025-04-08 9:45-11:00',
    '2025-04-08 11:30-13:00',
    '2025-04-08 14:15-16:00',
    '2025-04-08 16:30-18:00',
    '2025-04-10 9:00-10:30',
    '2025-04-10 11:00-12:30',
    '2025-04-10 13:45-15:00',
    '2025-04-10 15:30-16:45',
    '2025-04-11 9:00-10:30',
    '2025-04-11 11:00-12:30',
    '2025-04-11 14:00-16:00',
    '2025-04-11 16:30-18:00'
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

- [X] Monday, 9:00 - 10:30
- [X] Monday, 11:00 - 12:30
- [X] Monday, 13:45 - 15:00
- [X] Monday, 15:30 - 16:45
- [X] Tuesday, 9:45 - 11:00
- [X] Tuesday, 11:30 - 13:00
- [X] Tuesday, 14:15 - 16:00
- [X] Tuesday, 16:30 - 18:00
- [X] Thursday, 9:00 - 10:30
- [X] Thursday, 11:00 - 12:30
- [X] Thursday, 13:45 - 15:00
- [X] Thursday, 15:30 - 16:45
- [X] Friday, 9:00 - 10:30
- [X] Friday, 11:00 - 12:30
- [X] Friday, 14:00 - 16:00
- [X] Friday, 16:30 - 18:00
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

- [ ] Monday, 9:00 - 10:30
- [ ] Monday, 11:00 - 12:30
- [ ] Monday, 13:45 - 15:00
- [ ] Monday, 15:30 - 16:45
- [X] Tuesday, 9:45 - 11:00
- [X] Tuesday, 11:30 - 13:00
- [X] Tuesday, 14:15 - 16:00
- [ ] Tuesday, 16:30 - 18:00
- [ ] Thursday, 9:00 - 10:30
- [ ] Thursday, 11:00 - 12:30
- [ ] Thursday, 13:45 - 15:00
- [ ] Thursday, 15:30 - 16:45
- [ ] Friday, 9:00 - 10:30
- [ ] Friday, 11:00 - 12:30
- [ ] Friday, 14:00 - 16:00
- [ ] Friday, 16:30 - 18:00
`
    }
  ]
};