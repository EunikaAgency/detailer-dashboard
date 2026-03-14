# Android PWA Install Checklist

Use this checklist after deploying a manifest or service worker change.

1. Open `https://otsukadetailer.site/pwa/` in Chrome on Android.
2. If an older home-screen shortcut already exists and opens with browser chrome, remove it first.
3. Confirm the app exposes the native install flow:
   - in-app `Install App` action appears, or
   - Chrome menu shows `Install app`.
4. Install One Detailer using `Install app`, not a plain browser shortcut.
5. Launch One Detailer from the Android launcher/home screen.
6. Confirm the app opens without the normal Chrome URL/header bar in normal in-scope usage.
7. From launcher start, verify the app stays inside `/pwa/**` through:
   - boot
   - login
   - presentations
   - case selection
   - viewer
8. Open Diagnostics and confirm:
   - `Display Mode` is not `browser`
   - `Standalone Launch` reports installed app mode
9. Navigate across internal routes and confirm browser chrome does not appear.
10. Go offline after one successful online load and reopen from launcher.
11. Confirm the app shell still opens and no Chrome dinosaur page appears.
