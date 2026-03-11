# Sessions Grouping and Deterministic Naming

**Critical Context:** The Sessions screen shows **activity sessions**, not authentication sessions.

---

## 📊 What Gets Grouped

Activity sessions are built from **user activity events**, including:

### Event Types

**App Lifecycle:**
- `app_launch` - App opened
- `foreground` - App brought to foreground
- `background` - App sent to background

**Authentication Events (Behavioral):**
- `login_success` - Successful login
- `offline_granted` - Offline access granted
- `bypass_login` - Login bypassed
- `logout` - User logged out

**Navigation Events:**
- `screen_view` - Screen navigation

**Product Interaction:**
- `product_open` - Product selected
- `case_selection` - Case/deck selected

**Presentation Events:**
- `slide_changed` - Slide navigation
- `hotspot_tapped` - Hotspot clicked
- `fullscreen_toggled` - Fullscreen mode changed
- `orientation_changed` - Device orientation changed

---

## 🔄 How Sessions Are Grouped

### Grouping Algorithm

Events are **sorted by timestamp**, then grouped into sessions based on four rules:

#### 1. **No Current Session**
- First event always starts a new session

#### 2. **Inactivity Timeout (15 minutes)**
```typescript
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

if (timeSinceLastEvent > INACTIVITY_TIMEOUT) {
  // Start new session
}
```

**Behavior:**
- If the gap between events exceeds 15 minutes, the next event starts a new session
- Gap is measured: `currentEvent.timestampMs - lastEvent.timestampMs`

#### 3. **Explicit Session-Start Events**
```typescript
const SESSION_START_EVENTS = [
  'app_launch',
  'login_success',
  'offline_granted',
  'bypass_login'
];
```

**Behavior:**
- These events ALWAYS start a new session (even if inactivity < 15 minutes)
- Current session is completed before the new one starts

#### 4. **Tracked SessionId Changes**
```typescript
if (event.sessionId && event.sessionId !== lastSessionId) {
  // Start new session
}
```

**Behavior:**
- If events include a `sessionId` field and it changes, start new session
- Supports backend-driven session grouping

---

## 📦 Session Structure

Each session contains:

```typescript
interface Session {
  id: string;                    // "session-{startTimestamp}"
  title: string;                 // "Tuesday Morning Rise Drift"
  timeRange: string;             // "Mar 11, 2026 • 9:15 AM - 10:30 AM"
  moveCount: number;             // Total event count
  duration: string;              // "1h 15m"
  status: 'synced' | 'pending'; // Sync state
  startTime: number;             // Timestamp (ms)
  endTime: number;               // Timestamp (ms)
  events: SessionEvent[];        // Grouped events
}
```

### Field Details

**`id`**
- Format: `session-{startTime}`
- Example: `session-1741671360000`
- Stable identifier for session

**`title`**
- **Deterministic** human-readable title
- Generated from: weekday, time-of-day, event count
- Example: `Tuesday Morning Rise Drift`
- See "Deterministic Session Naming" section

**`timeRange`**
- Formatted date and time range
- Example: `Mar 11, 2026 • 9:15 AM - 10:30 AM`

**`moveCount`**
- **Total event count** (all events, not just screen_view)
- Used for intensity bucket calculation

**`duration`**
- Formatted duration between first and last event
- Examples: `15m`, `1h 30m`, `3h 5m`

**`status`**
- `pending` - Not all events synced to server
- `synced` - All events uploaded

**`startTime` / `endTime`**
- Unix timestamps in milliseconds
- Used for sorting and calculations

**`events`**
- Array of all events in this session
- Sorted by timestamp

---

## 🎯 Deterministic Session Naming

### Format

```
<Weekday> <Time Block> <Descriptor>
```

### Examples

- `Tuesday Morning Rise Drift`
- `Friday Afternoon Rally`
- `Monday Late Night Blink`
- `Wednesday Noon Stream`
- `Sunday Evening Marathon`

---

## 📅 Weekday Component

```typescript
const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
```

**Possible Values:**
- Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday

---

## 🕐 Time-of-Day Buckets (24 Buckets)

Time blocks are determined by the **hour** of the session start time:

| Hour(s) | Time Block |
|---------|------------|
| 0 | Midnight |
| 1-2 | Deep Night |
| 3 | Pre Dawn |
| 4 | First Light |
| 5 | Dawn |
| 6 | Early Morning |
| 7 | Morning Rise |
| 8 | Morning |
| 9-10 | Late Morning |
| 11-12 | Noon |
| 13 | Early Afternoon |
| 14-15 | Afternoon |
| 16 | Late Afternoon |
| 17 | Dusk |
| 18-19 | Evening |
| 20 | Late Evening |
| 21-22 | Night |
| 23 | Late Night |

---

## 📈 Activity Intensity Buckets

Intensity is determined by the **total event count** in the session:

### Intensity Thresholds

```typescript
function getIntensityBucket(eventCount: number) {
  if (eventCount <= 5) return 'micro';    // 1-5 events
  if (eventCount <= 15) return 'light';   // 6-15 events
  if (eventCount <= 35) return 'normal';  // 16-35 events
  if (eventCount <= 70) return 'busy';    // 36-70 events
  return 'heavy';                          // 71+ events
}
```

### Descriptor Pools by Intensity

#### **Micro (1-5 events)**
```
Blink, Quick, Snap, Nudge, Tap, Flick,
Zip, Ping, Dash, Skim, Peek, Pulse
```
*Brief, minimal activity*

#### **Light (6-15 events)**
```
Drift, Glide, Stroll, Cruise, Wander, Browse,
Flow, Ease, Roam, Ripple, Meander, Loop
```
*Casual, exploratory activity*

#### **Normal (16-35 events)**
```
Pulse, Loop, Drive, Trail, Rhythm, Stream,
Route, Track, Run, Cycle, Groove, Sprint
```
*Typical, productive activity*

#### **Busy (36-70 events)**
```
Surge, Hustle, Rally, Charge, Rush, Boost,
Blaze, Momentum, Power Flow, Fast Loop, Stride, Rapid Run
```
*High-energy, intensive activity*

#### **Heavy (71+ events)**
```
Marathon, Deep Dive, Long Run, Full Sweep, Extended Flow, Big Push,
Power Session, Ultra, Grind, Heavy Loop, Endurance, Overdrive
```
*Extended, sustained activity*

---

## 🎲 Deterministic Descriptor Selection

**Critical:** The descriptor is **NOT randomly chosen at render time**.

### Selection Algorithm

```typescript
function selectDescriptor(
  descriptors: string[], 
  timestamp: number, 
  eventCount: number
): string {
  // Create deterministic seed from timestamp and event count
  const seed = timestamp + eventCount;
  const index = Math.abs(seed) % descriptors.length;
  return descriptors[index];
}
```

### Key Properties

✅ **Reproducible** - Same inputs always give same output  
✅ **Deterministic** - No randomness involved  
✅ **Stable** - Doesn't change across rerenders  
✅ **Fast** - Simple modulo operation  

### Example

```typescript
// Session at timestamp 1741671360000 with 12 events
const timestamp = 1741671360000;
const eventCount = 12;
const intensity = getIntensityBucket(12); // 'light'
const descriptors = INTENSITY_DESCRIPTORS.light;
// ['Drift', 'Glide', 'Stroll', ...]

const seed = 1741671360000 + 12;
const index = Math.abs(seed) % descriptors.length;
const descriptor = descriptors[index]; // Always the same for this session
```

---

## 💾 Title Persistence

Titles are **persisted to localStorage** for stable display across reloads.

### Persistence Strategy

```typescript
// On session creation
if (persistedTitles.has(sessionId)) {
  // Use existing persisted title
  title = persistedTitles.get(sessionId);
} else {
  // Generate new deterministic title
  title = generateDeterministicSessionTitle(startTime, eventCount);
  // Persist for future
  persistSessionTitle(sessionId, title);
}
```

### Storage Key

```typescript
const SESSION_TITLES_KEY = 'sessionTitles';
```

### Storage Format

```json
[
  ["session-1741671360000", "Tuesday Morning Rise Drift"],
  ["session-1741675920000", "Tuesday Afternoon Rally"],
  ["session-1741690320000", "Tuesday Late Night Blink"]
]
```

### Benefits

✅ **Stability** - Titles don't change on page reload  
✅ **Performance** - No recalculation on every render  
✅ **Consistency** - Same session always shows same title  

---

## 🔄 Sync State

Sessions show **sync state** based on whether all events have been uploaded to the server.

### Sync State Calculation

```typescript
const allSynced = events.every(e => syncedIds.has(e.id));
const status = allSynced ? 'synced' : 'pending';
```

### States

**Pending**
- Not all events in the session have synced yet
- Some events are still queued locally
- Badge: "Pending" (yellow/orange)

**Synced**
- All events in the session have been uploaded
- Server has received all activity data
- Badge: "Synced" (green/blue)

### Important Notes

- Sync state is **derived from events**, not stored separately
- A session can be "Pending" even if the user is online
- A session can be "Synced" even if the user is currently offline
- Sync state is **unrelated to whether the user is currently logged in**

---

## 🚫 What Titles Are NOT

❌ **Not user-entered** - Titles are auto-generated  
❌ **Not from backend** - Generated client-side only  
❌ **Not random** - Deterministic selection  
❌ **Not based on screen names** - Based on time/intensity  
❌ **Not auth session names** - Activity session names  

---

## ✅ What Titles ARE

✅ **Deterministic** - Same inputs → same output  
✅ **Human-readable** - Natural language phrases  
✅ **Informative** - Convey timing and intensity  
✅ **Stable** - Persisted across reloads  
✅ **Local** - Generated and stored client-side  

---

## 🎯 Complete Example

### Input Events

```json
[
  { "action": "login_success", "timestampMs": 1741671360000 },
  { "action": "screen_view", "timestampMs": 1741671365000 },
  { "action": "product_open", "timestampMs": 1741671370000 },
  { "action": "slide_changed", "timestampMs": 1741671375000 },
  { "action": "slide_changed", "timestampMs": 1741671380000 },
  { "action": "hotspot_tapped", "timestampMs": 1741671385000 },
  { "action": "slide_changed", "timestampMs": 1741671390000 },
  { "action": "screen_view", "timestampMs": 1741671395000 },
  { "action": "product_open", "timestampMs": 1741671400000 },
  { "action": "slide_changed", "timestampMs": 1741671405000 },
  { "action": "slide_changed", "timestampMs": 1741671410000 },
  { "action": "logout", "timestampMs": 1741671415000 }
]
```

### Session Grouping

**New session starts because:**
- First event is `login_success` (explicit session-start event)

**Session continues because:**
- All subsequent events within 15-minute window
- No other session-start events
- No sessionId changes

### Session Calculation

```typescript
startTime = 1741671360000;  // First event
endTime = 1741671415000;    // Last event
duration = 55000ms;         // 55 seconds
eventCount = 12;            // 12 events

// Start time: Tuesday, March 11, 2026, 9:16:00 AM
weekday = "Tuesday";
hour = 9;
timeOfDay = "Late Morning";

// Intensity
intensityBucket = "light";  // 12 events (6-15 range)
descriptor = "Drift";       // Deterministically selected

// Final title
title = "Tuesday Late Morning Drift";
```

### Final Session Object

```json
{
  "id": "session-1741671360000",
  "title": "Tuesday Late Morning Drift",
  "timeRange": "Mar 11, 2026 • 9:16 AM - 9:16 AM",
  "moveCount": 12,
  "duration": "1m",
  "status": "pending",
  "startTime": 1741671360000,
  "endTime": 1741671415000,
  "events": [/* 12 events */]
}
```

---

## 🔍 Recommended Frame Note

**For Figma/Design Documentation:**

> Sessions are locally grouped activity timelines. They are split by a 15-minute inactivity rule and explicit start events, then given deterministic human-readable titles based on start time and activity volume.

**Short Version:**

> Activity sessions (not auth sessions) - grouped by inactivity and start events, titled deterministically from timing and intensity.

---

## 🛠️ Implementation Checklist

### Session Grouping

- [x] Sort events by timestamp
- [x] Check for no current session
- [x] Check for 15-minute inactivity timeout
- [x] Check for explicit session-start events
- [x] Check for sessionId changes
- [x] Group events into sessions

### Title Generation

- [x] Extract weekday from start time
- [x] Map hour to time-of-day bucket (24 buckets)
- [x] Calculate event count
- [x] Map event count to intensity bucket (5 buckets)
- [x] Select descriptor deterministically (not randomly)
- [x] Combine: `{weekday} {timeOfDay} {descriptor}`

### Title Persistence

- [x] Check localStorage for existing title
- [x] Generate new title if not found
- [x] Persist title to localStorage
- [x] Use persisted title on subsequent loads

### Sync State

- [x] Track synced event IDs separately
- [x] Check if all session events are synced
- [x] Display "Pending" or "Synced" badge

---

## 🎨 UI Display Examples

### Sessions List Card

```
┌─────────────────────────────────────────┐
│ Tuesday Late Morning Drift              │ <- Deterministic title
│ Mar 11, 2026 • 9:16 AM - 9:16 AM       │ <- Time range
│ 12 Moves • 1m                          │ <- Event count + duration
│ [Synced]                               │ <- Sync state badge
└─────────────────────────────────────────┘
```

### Session Detail Header

```
┌─────────────────────────────────────────┐
│ ← Tuesday Late Morning Drift            │ <- Title in header
│                                         │
│ Summary                                 │
│ Started on Tuesday at 9:16 AM and       │
│ included 12 moves across multiple       │
│ products.                               │
│                                         │
│ Duration: 1m                            │
│ Status: Synced ✓                        │
└─────────────────────────────────────────┘
```

---

## 📊 Title Distribution Examples

Given sessions at different times and intensities:

| Start Time | Events | Expected Title Format |
|------------|--------|-----------------------|
| Tue 9:16 AM | 3 | Tuesday Late Morning **Blink** *(micro)* |
| Tue 9:16 AM | 12 | Tuesday Late Morning **Drift** *(light)* |
| Tue 2:30 PM | 28 | Tuesday Afternoon **Stream** *(normal)* |
| Tue 2:30 PM | 52 | Tuesday Afternoon **Rally** *(busy)* |
| Tue 11:45 PM | 95 | Tuesday Late Night **Marathon** *(heavy)* |

---

**End of Sessions Specification**  
*March 11, 2026*
