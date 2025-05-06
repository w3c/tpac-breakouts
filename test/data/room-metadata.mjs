export default {
  metadata: {
    meeting: 'Validation of room metadata',
    timezone: 'Etc/UTC'
  },

  slots: [
    '2042-04-05 9:00 - 10:00',
    '2042-04-05 10:00 - 11:00'
  ],

  rooms: [
    'Just a room',
    'Inline (75 - basement) (VIP)',
    {
      name: 'VIP room',
      capacity: 25,
      vip: true
    },
    {
      name: 'In the back',
      location: '2nd floor',
      capacity: 40,
      vip: false,
      type: 'backroom'
    },
    {
      name: 'Weird',
      yes: '',
      location: 'somewhere'
    },
    {
      name: 'Hybrid (42)',
      capacity: 35,
      location: 'on ze web'
    }
  ],

  sessions: [
  ]
};