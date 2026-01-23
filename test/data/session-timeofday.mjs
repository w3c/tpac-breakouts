export default {
  metadata: {
    meeting: 'Validation test event',
    timezone: 'Etc/UTC'
  },

  slots: [
    '2042-04-05 9:00 - 10:00',
    '2042-04-05 10:00 - 11:00',
    '2042-04-05 11:00 - 12:00',
    '2042-04-05 12:00 - 13:00',
    '2042-04-05 13:00 - 14:00',
    '2042-04-05 14:00 - 15:00',
    '2042-04-05 15:00 - 16:00',
    '2042-04-05 22:00 - 23:00'
  ],

  rooms: [
    'Main',
    'Secondary',
  ],

  sessions: [
    {
      number: 1,
      title: 'No preference',
      body: `
        ### Preferred slots
        No preference`,
      room: 'Main',
      slot: '2042-04-05 9:00'
    },

    {
      number: 2,
      title: 'Morning session',
      body: `
        ### Preferred slots
        Morning slot`,
      room: 'Main',
      slot: '2042-04-05 10:00'
    },

    {
      number: 3,
      title: 'Afternoon session',
      body: `
        ### Preferred slots
        Afternoon slot`,
      room: 'Main',
      slot: '2042-04-05 14:00'
    },

    {
      number: 4,
      title: 'Evening session',
      body: `
        ### Preferred slots
        Evening slot`,
      room: 'Main',
      slot: '2042-04-05 22:00'
    }
  ]
};