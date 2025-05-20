export default {
  metadata: {
    meeting: 'Scheduling of tracks with sessions that have constraints',
    timezone: 'Etc/UTC'
  },

  slots: [
    '2042-04-05 9:00 - 10:00',
    '2042-04-05 10:00 - 11:00'
  ],

  rooms: [
    'Room 1',
    'Room 2'
  ],

  sessions: [
    {
      number: 1,
      author: 'ianbjacobs',
      title: 'Session with constraint',
      tracks: ['ux'],
      slot: '9:00',
      body: `
### Session description
Blah

### Session goal
Schedule test

### Session type
Breakout (Default)

### Additional session chairs (Optional)
_No response_

### IRC channel (Optional)
#scheduling

### Other sessions where we should avoid scheduling conflicts (Optional)
_No response_

### Instructions for meeting planners (Optional)
_No response_

### Agenda (link or inline) (Optional)
_No response_
`
    },
    {
      number: 2,
      author: 'tidoust',
      title: 'Session without constraint',
      tracks: ['ux'],
      body: `
### Session description
Blah

### Session goal
Schedule test

### Session type
Breakout (Default)

### Additional session chairs (Optional)
_No response_

### IRC channel (Optional)
#scheduling

### Other sessions where we should avoid scheduling conflicts (Optional)
_No response_

### Instructions for meeting planners (Optional)
_No response_

### Agenda (link or inline) (Optional)
_No response_
`
    }
  ]
};