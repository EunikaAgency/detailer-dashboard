# One Detailer - Implementation Principles & Architecture

**Status:** Reference Document  
**Purpose:** Core architectural decisions and implementation patterns

---

## 🎯 Core Architectural Principles

### 1. **Authentication vs Activity Sessions**

**CRITICAL DISTINCTION:**

| Concept | Purpose | Storage | Screen |
|---------|---------|---------|--------|
| **Auth Session** | Access control, login state | localStorage token | Login |
| **Activity Session** | Grouped usage timeline | localStorage events | Sessions |

**Activity Sessions:**
- Built from tracked user events (screen views, slide changes, hotspot taps)
- Grouped by inactivity timeout (15 minutes)
- Generated deterministic titles (e.g., "Tuesday Morning Rise Drift")
- Show sync state (Pending/Synced)
- Exist whether user is online or offline

**NOT Authentication Sessions:**
- Sessions screen does NOT show login/auth records
- Sessions screen does NOT show bearer tokens or cookies
- Sessions are behavioral timelines, not security records

---

## 🔄 App Flow & Data Hydration

### Startup Flow

```
1. Boot Screen (startup hydration)
   ↓
   - Restore auth state from localStorage
   - Restore account profile from localStorage
   - Restore settings from localStorage
   - Restore products from localStorage/IndexedDB
   - Restore sessions from localStorage
   - Restore cached media from IndexedDB
   ↓
2. Route Decision
   - Valid auth? → Gallery (Presentations)
   - No auth? → Login
```

**Key Point:** Returning users skip Login entirely if persisted auth is valid.

### Boot Recovery

**Two-Layer Recovery System:**
1. **App-level** - React error boundary with recovery UI
2. **HTML-level** - Fallback UI if JS never mounts

**Reset Action:**
- Clears localStorage
- Clears sessionStorage
- Clears all caches
- Clears IndexedDB
- Unregisters service workers
- Reloads app clean

---

## 📊 Data Architecture

### Product Data (3-Tier Fallback)

```typescript
// Tier 1: Live API
try {
  const response = await apiClient.getProducts();
  cache(response);
  return { products: response.products, source: 'live' };
} catch {
  // Tier 2: Cached
  const cached = getCachedProducts();
  if (cached) {
    return { products: cached, source: 'cached' };
  }
  
  // Tier 3: Bundled
  return { products: BUNDLED_PRODUCTS, source: 'bundled' };
}
```

**Gallery Content:**
- NOT fixed mock cards
- Built from normalized products config
- May use remote URLs, bundled assets, or IndexedDB blob URLs
- Same screen works for live/cached/bundled

---

## 🔒 Offline Authentication

### Shared-Secret Verification

**NOT a plain bypass** - uses cryptographic verification

**Three Token Formats:**

1. **Encrypted (strongest)** - `ode1.{encryptedPayload}`
   - AES-GCM encryption
   - Timestamp validation
   - User identifier extraction

2. **Short HMAC (14 chars)** - `AB12CD34EF56GH`
   - HMAC-SHA256 signature
   - Timestamp validation
   - User identifier extraction

3. **Legacy JWT** - `eyJ...` 
   - HS256 signature
   - Standard JWT validation
   - User identifier extraction

**Verification Flow:**
```typescript
const secret = getSharedSecret(); // From env or localStorage
const result = verifyOfflineCredential(token, secret);

if (result.valid) {
  setAuthToken('offline-granted');
  setAccountProfile(result.userIdentifier);
  navigate('/presentations');
}
```

**Offline Success:**
- Sets `authToken: 'offline-granted'`
- Opens app using cached/bundled content
- Still logs activity events locally
- Queue syncs when internet returns

---

## 📱 Activity Tracking & Sessions

### Event Types (Not Auth Events)

**Behavioral Events:**
- `app_launch` - App opened
- `screen_view` - Screen navigation
- `product_open` - Product selected
- `slide_changed` - Slide navigation
- `hotspot_tapped` - Hotspot clicked
- `orientation_changed` - Device rotated
- `fullscreen_toggled` - Fullscreen mode
- `foreground` / `background` - App visibility

**Auth-Related Events (Still Behavioral):**
- `login_success` - Successful login (starts activity session)
- `offline_granted` - Offline auth granted (starts activity session)
- `logout` - User logged out

**Key Point:** Even auth-related events are logged as activity, not security records.

### Session Grouping

**New Activity Session Starts When:**
1. No current active session
2. Inactivity > 15 minutes
3. Session-start action occurs:
   - `app_launch`
   - `login_success`
   - `offline_granted`
   - `bypass_login`
4. Event sessionId changes

**Session Object:**
```json
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
```

### Deterministic Session Titles

**Format:** `<Weekday> <Time Block> <Descriptor>`

**Generation Inputs:**
- Weekday of session start
- Time-of-day bucket (24 buckets: Midnight, Deep Night, Pre Dawn, First Light, Dawn, Early Morning, Morning Rise, Morning, Late Morning, Noon, Early Afternoon, Afternoon, Late Afternoon, Dusk, Evening, Late Evening, Night, Late Night)
- Activity intensity bucket based on event count

**Intensity Buckets:**
- `micro` (≤5 events) - Blink, Quick, Snap, Nudge, Tap, Flick, Zip, Ping, Dash, Skim, Peek, Pulse
- `light` (≤15 events) - Drift, Glide, Stroll, Cruise, Wander, Browse, Flow, Ease, Roam, Ripple, Meander, Loop
- `normal` (≤35 events) - Pulse, Loop, Drive, Trail, Rhythm, Stream, Route, Track, Run, Cycle, Groove, Sprint
- `busy` (≤70 events) - Surge, Hustle, Rally, Charge, Rush, Boost, Blaze, Momentum, Power Flow, Fast Loop, Stride, Rapid Run
- `heavy` (>70 events) - Marathon, Deep Dive, Long Run, Full Sweep, Extended Flow, Big Push, Power Session, Ultra, Grind, Heavy Loop, Endurance, Overdrive

**Examples:**
- `Tuesday Morning Rise Drift` - Tuesday morning, light activity
- `Friday Afternoon Rally` - Friday afternoon, busy activity
- `Monday Late Night Blink` - Monday late night, micro activity

**Persistence:**
- Generated once when session created
- Persisted to localStorage
- Reused on subsequent renders
- Ensures stable display across reloads

---

## 🎬 Presentation Viewer Architecture

### Media Type Support

**Three Slide Types:**

1. **Image Slides**
   - Primary type
   - Supports hotspots
   - object-fit: contain positioning
   - Optional dynamic backdrop

2. **Video Slides**
   - Native `<video>` element
   - Controls enabled
   - No hotspot support

3. **HTML Slides**
   - iframe rendering
   - Centered/resized to fit stage
   - No hotspot support

### Hotspot Implementation

**Data-Driven from JSON:**
```json
{
  "type": "image",
  "url": "slide-2.jpg",
  "hotspots": [
    {
      "x": 0.12,
      "y": 0.18,
      "w": 0.20,
      "h": 0.16,
      "targetPageId": "slide-5.jpg"
    }
  ]
}
```

**Key Characteristics:**
- Normalized coordinates (0-1), NOT pixels
- Positioned relative to rendered image, NOT container
- Account for `object-fit: contain` margins
- targetPageId resolves to slide index at runtime
- Always clickable (even when visual markers hidden)

**Show Hotspot Areas Setting:**
- Visual debug/training toggle
- Reveals blue rectangular overlays
- Does NOT control clickability
- Hotspots work whether visible or invisible

### Viewer State Persistence

**Persisted States:**
- Fullscreen mode
- Orientation preference
- Thumbnail visibility
- Zoom level
- Dynamic backdrop enabled

**NOT Momentary Button Styles:**
- State persists across navigation
- Restored on viewer re-entry
- Saved to localStorage

---

## 💾 Media & Caching Strategy

### Media Sources (Progressive)

**Four Source Types:**
1. **Remote URLs** - Live CDN/API images
2. **Bundled Assets** - Compiled into app
3. **IndexedDB Blobs** - Offline cached media
4. **Object URLs** - Recreated from IndexedDB on restart

**Loading Strategy:**
```typescript
// 1. Try remote URL
<img src={slide.url} onError={handleError} />

// 2. On error, try IndexedDB cache
const cachedBlob = await getFromIndexedDB(slide.url);
if (cachedBlob) {
  const objectUrl = URL.createObjectURL(cachedBlob);
  return objectUrl;
}

// 3. Show fallback UI
return <FallbackPlaceholder />;
```

### PWA Media Cache

- Managed offline storage in IndexedDB
- Separate from browser HTTP cache
- App-controlled retention & pruning
- Same image component works for all sources

---

## ⚙️ Settings Architecture

### Settings Are Local Preferences

**NOT Server-Backed:**
- Stored in localStorage only
- Restored on startup
- Immediately affect UI behavior
- No API sync required

**Categories:**

**Basic Settings:**
- Show gallery labels
- Gallery columns (2/3/4)
- Button style (rounded/minimal)
- UI scale (compact/default/large)

**Advanced Settings:**
- Show hotspot areas
- Dynamic slide backdrop
- Factory reset
- Debug mode

**Behavioral Impact:**
```typescript
// Settings immediately affect rendering
const showLabels = getSetting('showGalleryLabels');
const columns = getSetting('galleryColumns');
const showHotspots = getSetting('showHotspotAreas');

// No API call, no loading state
```

---

## 🔄 Sync & Reconnect Strategy

### Offline Activity Queue

**While Offline:**
1. User performs actions
2. Events tracked locally
3. Events added to sync queue
4. Sessions screen works immediately
5. Sessions show "Pending" state

**When Internet Returns:**
```typescript
// 1. Silent auth upgrade
try {
  await attemptOnlineLogin(savedCredentials);
  setAuthToken(response.authToken);
} catch {
  // Stay offline-granted
}

// 2. Sync queued events
await syncPendingEvents();

// 3. Update session states
refreshSessions(); // Now show "Synced"
```

**Sync Triggers:**
- Manual sync button
- App foreground
- Periodic polling (every 5 minutes)
- Successful reconnect

---

## 🎨 Case Selection Architecture

### Deck Normalization

**NOT Fixed Mock Cards:**
```typescript
// Product may have media groups or subcases
const decks = product.media || product.subcases || [];

// Normalize each deck
const normalizedDecks = decks.map(deck => {
  const slides = getRenderableSlides(deck.items || deck.slides);
  
  return {
    id: deck.groupId || deck.id,
    title: deck.title,
    slides: slides.length,
    duration: estimateDuration(slides.length),
    items: slides,
  };
}).filter(deck => deck.slides > 0);
```

**Only Renderable Slides:**
- Filter to `['image', 'video', 'html']` types
- Slide count computed after filtering
- Duration estimated from renderable count
- Empty decks hidden automatically

---

## 📋 Account Profile Architecture

### My Account Screen

**Read-Only Data:**
- NOT an editable form
- Hydrated from localStorage `accountProfile`
- Built from login response + current identifier
- May have partial data (some fields missing)

**Data Source:**
```typescript
// From login response
const profile = {
  identifier: response.user?.identifier || email,
  displayName: response.user?.displayName,
  email: response.user?.email,
  territory: response.user?.territory,
  role: response.user?.role,
};

// Saved to localStorage
localStorage.setItem('accountProfile', JSON.stringify(profile));

// Displayed on My Account screen
```

**Partial Data Handling:**
- Show only available fields
- Hide missing sections
- No "loading" state (data is always local)

---

## 🎯 Gallery Loading States

### Three Loading Scenarios

**1. First Load:**
```
Boot → Gallery Loading → Gallery (with data)
```

**2. Background Refresh:**
```
Gallery (cached) → [silent API refresh] → Gallery (updated)
```

**3. Empty/Error:**
```
Gallery Loading → Gallery Error (with fallback content)
```

**Layout Stability:**
- Keep card grid stable
- Placeholder cards match final size
- Prevent layout shift on load
- Skeleton loaders match content structure

---

## 🛠️ Menu & Navigation

### Install Row Conditional Display

**Three States:**

1. **"Install App"** - PWA installable, not installed
   - Shows install button
   - Triggers browser install prompt

2. **"How To Install"** - PWA installable but install triggered
   - Shows instructions
   - Platform-specific guidance

3. **Hidden** - Already in standalone mode
   - Row not shown
   - User already installed

**Detection:**
```typescript
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
const isInstallable = deferredPrompt !== null;

if (isStandalone) {
  // Hide row
} else if (isInstallable) {
  // Show "Install App"
} else {
  // Show "How To Install"
}
```

---

## 📱 PWA Capabilities

### Service Worker Strategy

**Offline-First:**
- Cache HTML/CSS/JS on install
- Cache media on demand
- Network first for API calls
- Cache fallback on network failure

**Update Strategy:**
- Check for updates on foreground
- Prompt user to refresh if update available
- Skip waiting on user confirmation

### Manifest Configuration

**Key Properties:**
- `name`: "One Detailer"
- `short_name`: "One Detailer"
- `start_url`: "/"
- `display`: "standalone"
- `theme_color`: "#1e3a8a" (blue-900)
- `background_color`: "#f8fafc" (slate-50)

---

## 🎨 UI Architecture Principles

### Responsive Design

**Mobile-First:**
- Base styles for mobile (320px+)
- Tablet breakpoint: 768px (md:)
- Desktop breakpoint: 1024px (lg:)

**Gallery Grid:**
```typescript
// 2 columns: md:grid-cols-2
// 3 columns: md:grid-cols-3 lg:grid-cols-3
// 4 columns: md:grid-cols-4 lg:grid-cols-4
```

### Component Reusability

**Shared UI Components:**
- `<Card>` - Base container
- `<Pill>` - Category/status badges
- `<FilterChip>` - Toggle filters
- `<SegmentedControl>` - Multi-option selector
- `<StickyHeader>` - Page header with actions

**Viewer-Specific:**
- `<HotspotOverlay>` - Interactive regions
- `<ImageWithFallback>` - Progressive image loading

---

## 🔍 Debug & Development

### Debug Mode Features

**When Enabled:**
- Diagnostic overlays
- Hotspot visibility helpers
- Local demo/debug content
- Console logging enhanced
- Event tracking visible

**Factory Reset:**
- Destructive operation
- Clears ALL browser storage
- Confirmation required
- Reloads app clean

---

## 📚 Key Takeaways

### For Implementation

1. **Sessions = Activity Timelines, NOT Auth Records**
2. **Offline Auth = Cryptographic Verification, NOT Bypass**
3. **Gallery = Normalized Data, NOT Mock Cards**
4. **Settings = Local Prefs, NOT Server-Backed**
5. **Boot = Hydration State, NOT Loading Spinner**
6. **Media = Multi-Source, NOT Single URL**
7. **Hotspots = Normalized Coords, NOT Pixels**

### For Design/Figma

1. **Don't call Sessions "Login Sessions"**
2. **Don't show offline as "unprotected"**
3. **Don't design Gallery with fixed 6 cards**
4. **Don't design Settings as form submission**
5. **Don't skip Boot recovery states**
6. **Don't assume images always load**
7. **Don't position hotspots in pixel coordinates**

---

## 🎯 Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│  One Detailer Architecture                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Auth Layer                                             │
│  ├─ Online: Bearer token                                │
│  ├─ Offline: Shared-secret verified credentials         │
│  └─ Persisted: localStorage authToken                   │
│                                                          │
│  Data Layer (3-Tier)                                    │
│  ├─ Live: API fetch                                     │
│  ├─ Cached: localStorage + IndexedDB                    │
│  └─ Bundled: Compiled fallback                          │
│                                                          │
│  Activity Tracking                                       │
│  ├─ Events: Tracked locally                             │
│  ├─ Sessions: Grouped by inactivity                     │
│  ├─ Titles: Generated deterministically                 │
│  └─ Sync: Queue when offline, upload when online        │
│                                                          │
│  Media Strategy                                          │
│  ├─ Remote URLs: Live CDN                               │
│  ├─ IndexedDB: Offline blobs                            │
│  ├─ Object URLs: Recreated on restart                   │
│  └─ Fallback: Error UI                                  │
│                                                          │
│  PWA Capabilities                                        │
│  ├─ Service Worker: Offline-first caching               │
│  ├─ Manifest: Installable                               │
│  └─ IndexedDB: Managed storage                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

**End of Implementation Principles Documentation**  
*March 11, 2026*
