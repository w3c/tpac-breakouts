# For TPAC session organizers

The `sessions/` contains one JSON file per proposed breakout, with a name matching the proposed shortname of the session. That JSON file contains the following fields (mandatory unless stated otherwise):
* `title` is the title of the session
* `proposer` is an object describing the session proposer, with the following fields
  * `name` is their name
  * `login` is their W3C login
  * `email` is their email address
* `summary` is a short description of the session - HTML is permitted
* ̀goals` is a string or an array of strings describing the goal(s) of the session
* `type` is a string or an array of string describing the type of sessions (e.g. open discussion, talk, panel)
* `others` is an optional array of the W3C logins of other critical parties to the session (beyond the proposer)
* `possibleSlots` is an optional array of integers indicating during which timeslots the session can be scheduled (first slot is 0); if not defined, any slot is assumed to be acceptable
* `capacity` is an optional string with value either of `big`, `medium` or `small`, describing the room size needed based on expected participation

# Only needed for W3C Staff plenary day organizers

`rooms.json` is an object whose keys are unique ids for rooms, and whose values are objects describing the said rooms, with the following fields
* `name` is the human readable name of the room
* `floor` is the floor on which the room is located
* `size` is the rough capacity of the room (one of big, medium, small)
* `capacity` is the number of people that can sit in the room

`grid.json` is an array of objects; each object describes one of the breakout timeslots, and has for keys the ids of the rooms defined in `rooms.json`. The value associated with a given key is the shortname of the session that will be run in the said room in the said slot.

# Scripts
`validate-sessions.js` checks that the session data is valid and consistent.

`validate-grid.js` checks that the proposed gridd is valid and consistent.

`build-sessions-page.js` generates `sessions.html` - the list of sessions as defined by `grid.json`.