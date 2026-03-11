Sessions: how activities are grouped and named

A “Session” in One Detailer is not fetched from a backend sessions API. It is built locally from tracked activity events.

==================================================
1. WHAT A SESSION IS
==================================================

The app records local activity events such as:
- app launch
- login success
- offline granted
- screen views
- product opens
- presentation selection
- slide changes
- hotspot taps
- fullscreen/orientation changes
- app foreground/background
- logout

These raw events are then grouped into Sessions for the Sessions screen.

==================================================
2. HOW EVENTS ARE GROUPED INTO SESSIONS
==================================================

Sessions are built from the ordered local activity event stream.

A new session starts when:
- there is no current active session
- inactivity gap is greater than 15 minutes
- event explicitly starts a new session
- event sessionId changes

Inactivity timeout
- 15 minutes
- constant in code: `SESSION_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000`

Events that explicitly start a new session
- `app_launch`
- `login_success`
- `offline_granted`
- `bypass_login`

Grouping logic summary
- sort events by timestamp ascending
- walk through them in order
- split into a new session when timeout/explicit-start/sessionId-change occurs
- each resulting session gets:
  - id
  - title
  - startTime
  - endTime
  - duration
  - eventCount
  - submitted / pending sync state
  - events[]

Design implication
The Sessions screen is a local behavioral timeline, not a server-owned object list.

==================================================
3. SESSION ID BEHAVIOR
==================================================

If a tracked event already has a sessionId:
- the grouping logic keeps using it

If no sessionId exists:
- the app generates a local fallback session id such as:
  `local-session-<timestamp>-<index>`

Important
The internal session id is technical and should not be shown to users.

==================================================
4. SESSION TITLE GENERATION
==================================================

Session titles are generated deterministically from:
- session start day/time
- time-of-day bucket
- event count / intensity bucket

The title format is:

`<Weekday> <Time Block> <Descriptor>`

Examples:
- `Tuesday Morning Rise Drift`
- `Friday Afternoon Rally`
- `Monday Late Night Blink`

Title inputs

A. Weekday
Derived from session start date:
- Monday
- Tuesday
- etc.

B. Time block
Derived from minute-of-day bucket.
Examples include:
- Midnight
- Deep Night
- Pre Dawn
- First Light
- Dawn
- Early Morning
- Morning Rise
- Morning
- Late Morning
- Noon
- Early Afternoon
- Afternoon
- Late Afternoon
- Dusk
- Evening
- Late Evening
- Night
- Late Night

C. Descriptor
Derived from event-count intensity bucket.

Intensity buckets:
- `micro` for <= 5 events
- `light` for <= 15 events
- `normal` for <= 35 events
- `busy` for <= 70 events
- `heavy` for > 70 events

Descriptor pools:
- micro:
  Blink, Quick, Snap, Nudge, Tap, Flick, Zip, Ping, Dash, Skim, Peek, Pulse
- light:
  Drift, Glide, Stroll, Cruise, Wander, Browse, Flow, Ease, Roam, Ripple, Meander, Loop
- normal:
  Pulse, Loop, Drive, Trail, Rhythm, Stream, Route, Track, Run, Cycle, Groove, Sprint
- busy:
  Surge, Hustle, Rally, Charge, Rush, Boost, Blaze, Momentum, Power Flow, Fast Loop, Stride, Rapid Run
- heavy:
  Marathon, Deep Dive, Long Run, Full Sweep, Extended Flow, Big Push, Power Session, Ultra, Grind, Heavy Loop, Endurance, Overdrive

Descriptor selection is deterministic
- not random at render time
- selected from:
  - weekday
  - 15-minute time bucket index
  - day of month
  - month
  - event count bucket

So the generated title is reproducible from the same session inputs.

==================================================
5. TITLE STABILITY / PERSISTENCE
==================================================

The app also persists session titles locally.

Behavior:
- when sessions are built, a generated title is assigned
- persisted titles are kept in local storage
- if a session already has a saved title, that title is reused
- this keeps naming stable across renders and restarts

Design implication
Treat session title as:
- deterministic first-generation naming
- then persistent/stable once recorded

==================================================
6. SESSION CARD FIELDS
==================================================

Each session shown in the Sessions list includes:
- generated title
- time range
- move count (`eventCount`)
- duration
- sync state:
  - Synced
  - Pending

Sample session object
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
7. SYNC STATE
==================================================

A session is shown as Synced only if all of its events have been marked synced.

If any event is not yet synced:
- session shows as Pending

So session status is derived from event sync state, not a separate backend session flag.

==================================================
8. SESSION DETAIL SCREEN
==================================================

When a session is opened:
- show summary card
- show headline/detail summary
- show events in reverse chronological order
- each event can show readable title, timestamp, subtitle, and optional metadata

The summary text is derived from actual event content:
- top product(s)
- top case
- viewed slide count
- total moves
- duration

==================================================
9. WHAT FIGMA SHOULD SHOW
==================================================

For Sessions, design these states:
1. Sessions list with generated human-readable titles
2. Mixed `Synced` and `Pending` cards
3. Empty state: “No sessions yet.”
4. Session detail timeline
5. Session summary card

Recommended annotation
“Sessions are derived locally from tracked activity events. New sessions begin on login/app launch or after 15 minutes of inactivity. Titles are generated deterministically from start time and activity volume, then persisted for stable display.”

Short version
“Session titles are not manually typed. They are generated deterministically from session start time and event count, then reused from local storage for stability.”
