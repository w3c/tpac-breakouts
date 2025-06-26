export default {
  metadata: {
    meeting: 'Indirect conflicts test event',
    timezone: 'Etc/UTC',
    type: 'groups'
  },

  slots: [
    '2042-02-10 9:00 - 11:00',
    '2042-02-10 11:00 - 13:00',
    '2042-02-10 14:00 - 16:00',
    '2042-02-10 16:00 - 18:00',
    '2042-02-11 9:00 - 11:00',
    '2042-02-11 11:00 - 13:00',
    '2042-02-11 14:00 - 16:00',
    '2042-02-11 16:00 - 18:00',
    '2042-02-13 9:00 - 11:00',
    '2042-02-13 11:00 - 13:00',
    '2042-02-13 14:00 - 16:00',
    '2042-02-13 16:00 - 18:00',
    '2042-02-14 9:00 - 11:00',
    '2042-02-14 11:00 - 13:00',
    '2042-02-14 14:00 - 16:00',
    '2042-02-14 16:00 - 18:00'
  ],

  rooms: [
    'Room 1',
    'Room 2',
    'Room 3'
  ],

  sessions: [
    {
      number: 1,
      title: 'Media WG',
      slot: '2042-02-10 9:00',
      room: 'Room 1'
    },

    {
      number: 2,
      title: 'Web Real-Time Communications WG',
      slot: '2042-02-10 9:00',
      room: 'Room 2'
    },

    {
      number: 3,
      title: 'Media WG & Web Real-Time Communications WG joint meeting',
      slot: '2042-02-10 11:00',
      room: 'Room 1'
    },

    {
      number: 4,
      title: 'Timed Text WG',
      body: `
### Session description
No conflict with Media WG, and by extension with Media WG joint meetings
### Other meetings where we should avoid scheduling conflicts (Optional)
#1
        `,
      slot: '2042-02-10 11:00',
      room: 'Room 2'
    },

    {
      number: 5,
      title: 'Timed Text WG & Second Screen WG joint meeting',
      body: `
### Session description
Joint meeting that involves Timed Text WG, should not conflict with Media WG
        `,
      slot: '2042-02-10 9:00',
      room: 'Room 3'
    }
  ]
}