Diagnostics Logs spec

Diagnostics Logs are part of Advanced Settings and expose runtime troubleshooting data collected by the app. This is a browser-first diagnostics feature, not a backend log viewer.

==================================================
1. WHAT DIAGNOSTICS LOGS ARE
==================================================

The app records runtime diagnostic events in local browser storage.
These logs are used for:
- troubleshooting auth issues
- API request/response tracing
- sync failures
- media/cache behavior
- startup/runtime errors
- viewer/debug instrumentation

This is local app telemetry for support/debugging, not server logs.

==================================================
2. WHERE DIAGNOSTICS LOGS APPEAR
==================================================

Diagnostics Logs are shown in:
- Advanced Settings

That section includes:
- current runtime session id
- file/location info
- number of stored entries
- retention period
- Copy log action
- Download log action

Displayed fields example
- Session: runtime-20260311-0815
- File: n/a or browser-memory
- Entries: 184
- Retention: 7 days

Design implication
This section should feel like an operational diagnostics panel, not a consumer export feature.

==================================================
3. HOW LOGGING IS STORED
==================================================

In the current browser-first PWA:
- logs are stored locally
- browser storage is used instead of native filesystem logging
- exported content is generated from accumulated log entries

Important
There may not be a real device file path in browser mode.
So “File” may be blank, `n/a`, or a browser-specific placeholder.

==================================================
4. WHAT GETS LOGGED
==================================================

The logger captures runtime events such as:
- auth attempts and failures
- token refresh attempts
- API requests and response failures
- mobile-config fetches
- product fetches
- sync attempts and sync failures
- startup and bootstrap events
- storage operations
- online/offline transitions
- presentation viewer load failures
- slide freshness/debug events
- reset/recovery actions

This means Diagnostics Logs are a developer/support surface, not a user content surface.

==================================================
5. DIAGNOSTICS SNAPSHOT MODEL
==================================================

Advanced Settings reads a diagnostics snapshot object similar to:

{
  "sessionId": "runtime-20260311-0815",
  "filePath": "",
  "count": 184,
  "retentionDays": 7
}

Field meanings
- `sessionId`
  current debug logging session identifier
- `filePath`
  physical/native log path if available; in browser this may be empty
- `count`
  current number of stored log entries
- `retentionDays`
  how long logs are retained before rotation/pruning

==================================================
6. COPY LOG ACTION
==================================================

Action:
- `Copy log`

Behavior:
- app exports the current runtime log text
- writes full text to clipboard
- shows success or failure status message

Typical success message
- `Diagnostics log copied to clipboard.`

Typical failure message
- `Copy failed: <reason>`

Design implication
This action is immediate and lightweight.
Figma should show a small inline status message area below the buttons.

==================================================
7. DOWNLOAD LOG ACTION
==================================================

Action:
- `Download log`

Behavior:
- app exports runtime log text
- creates a text blob
- downloads it as a `.log` file

Filename example
- `runtime-runtime-20260311-0815.log`
or
- `runtime-session.log`

Typical success message
- `Log exported.`
or
- `Log exported. Device file: ...` when a URI exists

Typical failure message
- `Export failed: <reason>`

Design implication
This is still a local export tool, not a cloud sync action.

==================================================
8. RELATIONSHIP TO DEBUG MODE
==================================================

Diagnostics Logs are most meaningful when Debug Mode is enabled, because:
- more diagnostic events are captured
- more viewer/runtime detail is available
- troubleshooting information is richer

However, the Diagnostics Logs section still exists as part of Advanced Settings UI and should be designed as a technical diagnostics card regardless.

==================================================
9. WHAT FIGMA SHOULD SHOW
==================================================

Create these diagnostics states:

1. Default diagnostics card
- session id shown
- file shown as `n/a` or blank
- entries count shown
- retention shown
- Copy log and Download log buttons

2. Copy success state
- inline status text:
  `Diagnostics log copied to clipboard.`

3. Copy failure state
- inline status text:
  `Copy failed: unknown error`

4. Download success state
- inline status text:
  `Log exported.`

5. Download failure state
- inline status text:
  `Export failed: unknown error`

Design recommendation
- Use a compact metadata stack
- Keep export buttons grouped and aligned
- Include a muted status text line below actions
- Make the card clearly technical but visually consistent with the app

==================================================
10. WHAT IT IS NOT
==================================================

Diagnostics Logs are not:
- audit logs from backend
- user-facing activity history
- the Sessions screen
- analytics dashboard
- cloud log archive

Important distinction
- Sessions screen = grouped user activity history
- Diagnostics Logs = technical runtime troubleshooting logs

Recommended annotation
“Diagnostics Logs expose local runtime troubleshooting data such as auth, API, sync, storage, and viewer errors. Copy and Download export the current local log for support/debug use.”
