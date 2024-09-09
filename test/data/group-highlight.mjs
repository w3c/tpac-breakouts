export default {
  allowMultipleMeetings: true,
  description: 'meeting: Group meeting highlights, timezone: Etc/UTC, type: groups',

  days: [
    'Monday (2042-02-10)'
  ],

  slots: [
    '9:00 - 11:00',
    '11:00 - 13:00',
    '14:00 - 16:00'
  ],

  rooms: [
    'Room 1',
    'Room 2',
    'Room 3'
  ],

  sessions: [
    {
      number: 1,
      title: 'WICG: Digital Credentials API',
      room: 'Room 1',
      meeting: 'Monday, 11:00'
    },

    {
      number: 2,
      title: 'Web Platform Incubator CG',
      room: 'Room 1',
      meeting: 'Monday, 9:00; Monday, 14:00'
    },

    {
      number: 3,
      title: 'WAI-Engage: Web Accessibility Community Group',
      room: 'Room 2',
      meeting: 'Monday, 9:00'
    },

    {
      number: 4,
      title: 'Second Screen WG > OSP',
      room: 'Room 2',
      meeting: 'Monday, 11:00'
    },

    {
      number: 5,
      title: 'Second Screen WG & Media WG Joint Meeting: Media streaming',
      room: 'Room 2',
      meeting: 'Monday, 14:00'
    },

    {
      number: 6,
      title: '> Just an highlight',
      room: 'Room 3',
      meeting: 'Monday, 9:00'
    },

    {
      number: 7,
      title: 'Web Payments Working Group: money money money',
      room: 'Room 3',
      meeting: 'Monday, 11:00'
    }
  ]
}