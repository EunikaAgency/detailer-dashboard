# PWA Hardening Acceptance Matrix

Use this matrix before release for the offline-capable presentation flow.

## Core install and launch

- Clean install online in Safari, Chrome, and Android WebView wrapper.
- Clean install, close app, relaunch offline.
- Install from iPhone Home Screen and verify first launch without Safari chrome.
- Confirm app shell, icons, and manifest load from the current deployed bundle only.

## Deck download integrity

- Download one deck fully and present every slide offline.
- Interrupt a deck download mid-transfer and confirm deck state becomes `incomplete`.
- Reopen app after interrupted download and verify repair/redownload succeeds.
- Force-remove one required cached asset and confirm deck state becomes `corrupted`.
- Change deck manifest revision and confirm prior offline copy becomes `needs_update`.

## Update safety

- Deploy a new bundle while an older service worker exists.
- Verify app shows `Update available` instead of force-reloading mid-session.
- Start a presentation, keep it active, and confirm update is deferred until user refreshes at a safe point.
- Refresh after update and verify caches are not mixed across old/new bundle versions.

## Storage resilience

- Verify storage estimate displays quota, usage, and free headroom where supported.
- Attempt large offline downloads on a low-storage device and confirm warning is shown.
- Fill device storage, relaunch app, and confirm corrupted or incomplete decks are reported instead of silently failing.

## Session continuity and sync

- Record presentation activity offline and confirm events land in IndexedDB sync queue.
- Reconnect network and confirm queued session events sync successfully.
- Simulate sync failure and confirm retry count and last error are recorded.
- Verify no session history is lost after background/foreground transitions.

## iPhone-specific behavior

- Test iPhone Safari tab mode and Home Screen mode separately.
- Verify post-install offline launch on iPhone Home Screen.
- Background app during deck download, resume, and confirm state remains valid.
- Relaunch after several days idle and verify stale caches are detected and update flow still works.

## Recovery tools

- Open Offline Support while offline and confirm downloaded deck counts are visible.
- Clear offline media and deck caches from in-app controls.
- Verify app can recover without requiring manual Safari storage clearing.
