export default {
  metadata: {
    meeting: 'Validation of "VIP" rooms',
    timezone: 'Etc/UTC',
    type: 'groups'
  },

  days: [
    'Monday (2042-02-10)',
    'Tuesday (2042-02-11)',
    'Thursday (2042-02-13)',
    'Friday (2042-02-14)'
  ],

  slots: [
    '9:00 - 11:00',
    '11:00 - 13:00',
    '14:00 - 16:00',
    '16:30 - 18:00'
  ],

  rooms: [
    'Business (25) (VIP)',
    'Economy (25)'
  ],

  sessions: [
    {
      number: 1,
      title: 'Advisory Committee',
      room: 'Business (25) (VIP)'
    },

    {
      number: 2,
      title: 'Second Screen WG'
    },

    {
      number: 3,
      title: 'Media WG'
    },

    {
      number: 4,
      title: 'GPU for the Web WG'
    }
  ]
};