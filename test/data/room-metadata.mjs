export default {
  description: 'meeting: Validation of room metadata, timezone: Etc/UTC',

  days: [
    '2042-04-05'
  ],

  slots: [
    '9:00 - 10:00',
    '10:00 - 11:00'
  ],

  rooms: [
    'Just a room',
    'Inline (75 - basement) (VIP)',
    {
      name: 'VIP room',
      description: `
- capacity: 25
- vip: true
`
    },
    {
      name: 'In the back',
      description: `
* location: 2nd floor
* capacity: 40
* vip: false
* type: backroom`
    },
    {
      name: 'Weird',
      description: `
-
- yes
- location: somewhere`
    },
    {
      name: 'Hybrid (42)',
      description: `capacity: 35
location: on ze web`
    }
  ],

  sessions: [
  ]
};