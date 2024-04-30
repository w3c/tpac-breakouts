export default {
  description: 'meeting: Validation of "None" select option, timezone: Etc/UTC',

  days: [
    '2042-04-05'
  ],

  slots: [
    '9:00 - 10:00'
  ],

  rooms: [
    'Main (25)'
  ],

  sessions: [
    {
      number: 1,
      title: 'No session type',
      body: `
### Session type
None
### Estimated number of in-person attendees
Fewer than 20 people`
    },

    {
      number: 2,
      title: 'No capacity given',
      body: `
### Session type
Breakout (Default)
### Estimated number of in-person attendees
None`
    }
  ]
};