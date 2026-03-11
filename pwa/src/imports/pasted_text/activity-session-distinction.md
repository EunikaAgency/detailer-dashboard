Sessions in One Detailer: activity sessions, not authentication sessions

Important distinction

In this app, the Sessions screen does NOT show authentication sessions.
It shows activity sessions.

Two different meanings exist:

1. Authentication session
- login state / access state
- examples:
  - bearer token
  - cookie-only authenticated state
  - offline-granted auth state
- purpose:
  controls whether the user can enter and use the app

2. Activity session
- a grouped timeline of user behavior inside the app
- purpose:
  shows what the rep did during a continuous period of use

The Sessions screen only shows activity sessions.

==================================================
1. WHAT AN ACTIVITY SESSION CONTAINS
==================================================

An activity session is built from tracked user events such as:
- app launch
- login success
- offline access granted
- screen view
- product open
- case selection
- slide change
- hotspot tap
- fullscreen toggle
- orientation change
- foreground/background transitions
- logout

These are behavioral timeline events, not security/auth records.

==================================================
2. HOW ACTIVITY SESSIONS ARE FORMED
==================================================

The app groups activity events into sessions locally.

A new activity session starts when:
- there is no current active activity session
- inactivity exceeds 15 minutes
- a session-start action occurs
- event sessionId changes

Session-start actions include:
- `app_launch`
- `login_success`
- `offline_granted`
- `bypass_login`

Important
Even though login-related actions can start a new activity session, that activity session is still not the same thing as the auth session/token.

==================================================
3. WHAT THE USER SEES ON THE SESSIONS SCREEN
==================================================

Each Sessions card represents one activity block and shows:
- generated session title
- time range
- number of Moves / tracked events
- duration
- sync state:
  - Synced
  - Pending

Example activity session object
{
  "id": "local-session-1741671360000-0",
  "title": "Tuesday Morning Rise Drift",
  "startTime": 1741671360000,
  "endTime": 1741672560000,
  "duration": 1200000,
  "eventCount": 12,
  "submitted": false,
  "events": [...]
}

==================================================
4. DETERMINISTIC SESSION TITLES
==================================================

Activity session titles are generated automatically and deterministically from:
- weekday of session start
- time-of-day bucket
- activity intensity bucket based on event count

Format:
`<Weekday> <Time Block> <Descriptor>`

Examples:
- `Tuesday Morning Rise Drift`
- `Friday Afternoon Rally`
- `Monday Late Night Blink`

These titles are:
- generated from activity session timing and volume
- not entered by the user
- not returned by auth/login API
- persisted locally for stable display

==================================================
5. SYNC STATE
==================================================

Activity sessions can be:
- `Pending`
- `Synced`

This state is derived from the sync status of underlying activity events.

Meaning:
- Pending = some or all activity events in that session have not yet been uploaded
- Synced = all activity events in that session have already been uploaded

This is unrelated to whether the user is currently logged in.

==================================================
6. OFFLINE BEHAVIOR
==================================================

Offline authenticated users still generate activity sessions.

Example:
- user logs in offline with a valid offline credential
- app grants access via `offline-granted`
- user browses products and presentation slides
- those actions are grouped into activity sessions
- those sessions appear in the Sessions screen even before network sync

Important
Offline access state and activity session history are separate concepts:
- offline access state = auth mode
- activity session = grouped behavior timeline

==================================================
7. WHY THIS DISTINCTION MATTERS FOR FIGMA
==================================================

Do NOT label the Sessions screen as:
- login sessions
- signed-in sessions
- authentication records
- security sessions

DO treat it as:
- activity history
- usage timeline
- grouped user behavior
- per-rep session summary

Recommended note for the Sessions frame
“Sessions shown here are activity sessions, not authentication sessions. They represent grouped user behavior over time and may exist whether the user is currently online or offline-authenticated.”

Short version
“Auth session = access control. Activity session = grouped usage history. The Sessions UI shows grouped usage history only.”
