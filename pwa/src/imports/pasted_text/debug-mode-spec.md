Debug mode spec

Debug mode is a persistent advanced setting that changes runtime behavior and exposes additional diagnostics/debug-only UI. It is not just a cosmetic badge.

==================================================
1. WHERE DEBUG MODE LIVES
==================================================

Debug mode is stored in local settings.

Setting field
{
  "debugMode": true
}

It is restored on startup as part of normal settings hydration.

The user toggles it from:
- Advanced Settings
- label: `Debug Mode`

==================================================
2. WHAT DEBUG MODE DOES
==================================================

When enabled, debug mode affects the app in multiple ways:

1. enables runtime debug logging
2. enables slide freshness diagnostics in the presentation viewer
3. allows diagnostic export actions to be useful/visible in Advanced Settings
4. enables demo/debug content injection, including the local demo product
5. makes the app behave more like a diagnostics build for troubleshooting

==================================================
3. RUNTIME DEBUG LOGGING
==================================================

When debug mode turns on:
- runtime debug logging is enabled
- logs are persisted in browser storage
- Advanced Settings can:
  - copy the log
  - download the log

Diagnostics snapshot includes fields like:
{
  "sessionId": "runtime-20260311-0815",
  "filePath": "",
  "count": 184,
  "retentionDays": 7
}

Design implication
Advanced Settings should feel like a technical diagnostics panel when debug mode is active.

==================================================
4. VIEWER DIAGNOSTICS
==================================================

When debug mode is enabled, the presentation viewer can show a slide freshness stamp.

Viewer overlay content example
Fetched: 2026-03-11 08:15:12
Age: 3 minutes ago

This freshness stamp is shown on the slide stage and updates over time.

What it tells the user
- when the slide/media was fetched
- how old the current cached slide is

Design implication
Figma should include a debug viewer variant with a small diagnostic stamp overlay in the slide stage.

==================================================
5. DEMO PRODUCT INJECTION
==================================================

When debug mode is enabled and demo content is allowed:
- the app injects a local demo product into the gallery
- this demo product includes multiple slide types:
  - image
  - video
  - html

Example debug/demo product behavior
- appears in gallery only when debug mode is on
- disappears when debug mode is off
- if the user currently has the demo product selected and debug mode is turned off, the app exits that selection

Design implication
The gallery may contain an extra local demo/test product only in debug mode.

==================================================
6. HOTSPOTS AND DEBUG
==================================================

Hotspot visibility is a separate setting:
- `showHotspots`

However, in practice debug mode is often used together with hotspot visibility because both are troubleshooting/demo behaviors.

Important distinction
- Debug mode itself does not directly mean hotspot outlines are shown
- hotspot outlines depend on `showHotspots`
- but Figma can reasonably show a combined “debug viewer” state where both are on

==================================================
7. ADVANCED SETTINGS BEHAVIOR
==================================================

Debug mode lives in Advanced Settings alongside:
- Factory Reset Cache
- Show hotspot areas
- Diagnostics Logs

When debug mode is ON:
- runtime logs accumulate
- copy/download log actions become meaningful
- diagnostics-oriented UI variants should be considered active

When debug mode is OFF:
- app returns to normal user-facing mode
- demo/debug-only product content is removed
- diagnostic overlays should not appear

==================================================
8. USER IMPACT
==================================================

Debug mode is intended for:
- QA
- troubleshooting
- content verification
- media freshness checks
- demo content validation

It is not a normal end-user productivity mode.

Design implication
The screen should still feel consistent with the app, but clearly more technical.

==================================================
9. WHAT FIGMA SHOULD SHOW
==================================================

Create these debug-mode variants:

1. Advanced Settings with Debug Mode OFF
- normal user-facing advanced screen

2. Advanced Settings with Debug Mode ON
- toggle active
- diagnostics logs section populated

3. Gallery with debug/demo product present
- optional extra product card for local demo content

4. Presentation Viewer with debug overlay
- freshness stamp visible
- optionally combine with hotspot-visible state for troubleshooting demo

Recommended annotation
“Debug Mode enables runtime diagnostics, slide freshness overlays, and debug/demo content. It is a persistent technical troubleshooting mode, not just a visual theme.”
