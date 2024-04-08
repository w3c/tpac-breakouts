export default {
  description: 'meeting: Group meetings test event, timezone: Etc/UTC, type: groups',

  days: [
    'Monday (2020-02-10)',
    'Tuesday (2020-02-11)',
    'Thursday (2020-02-13)',
    'Friday (2020-02-14)'
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
    }
  ]
}