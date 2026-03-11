Login
Startup can skip this screen entirely if persisted auth is still valid. Offline login is authenticated, not anonymous: the password field may contain a shared-secret-verified offline credential token. On success, the app stores auth/account/offline state locally and can continue without live internet.

Boot
This is a real startup hydration state. Before routing, the app restores auth, account profile, settings, products, sessions, and cached media from local storage / IndexedDB. Returning users may leave boot directly into Gallery instead of Login.

Boot Recovery
Two recovery layers exist to prevent white-screen failures: app-level bootstrap error UI and HTML-level fallback UI if the JS app never mounts. Reset clears localStorage, sessionStorage, caches, IndexedDB, and service workers, then reloads clean.

Gallery
Gallery content is built from normalized products config, not fixed mock cards. Product thumbnails may come from remote URLs, bundled assets, or offline IndexedDB blob URLs. Live API content, cached content, or bundled fallback content can all populate this same screen.

Gallery Loading
This loading state is important because products may render from cache first and refresh remotely in the background. Keep layout stable between placeholder and loaded cards.

Gallery Error / Empty
If live fetch fails, the app may still show cached or bundled content. A total failure only happens when neither remote, cached, nor bundled content is available.

Menu
This screen is mostly navigation state, but the install row is conditional. It can show Install App, How To Install, or be hidden entirely depending on PWA installability and standalone mode.

Settings
Settings are local persisted preferences, not a server-backed form. Values restore on startup and immediately affect UI shell behavior such as gallery density, UI scale, button style, hotspot visibility, and dynamic slide backdrop.

Advanced Settings
This screen controls technical/runtime behaviors. Factory reset is destructive and clears all browser-stored app state. Debug mode can expose diagnostics overlays, hotspot visibility helpers, and local demo/debug content.

My Account
This screen is hydrated from locally stored accountProfile built from login response user data plus current identifier. It is read-only and may open with partial data if some fields were not returned by the backend.

Sessions List
Sessions are not fetched from a sessions API. They are built locally from tracked activity events. New sessions start on login/app launch or after 15 minutes of inactivity. Sync state is derived from whether underlying events have been uploaded.

Session Detail
Summary text and event timeline are computed from local event history. Product names, case names, viewed slides, and move count are resolved from tracked metadata and current products config.

Case Selection
Case/deck cards are normalized from either product.media groups or product.subcases. Only renderable slides become part of a deck. Slide count and estimated duration are derived after normalization, not manually authored.

Presentation Viewer
Viewer supports image, video, and HTML slides from mixed media sources: bundled assets, remote URLs, uploads, or offline blob URLs. Fullscreen, orientation mode, thumbnails visibility, and zoom are persisted viewer states, not just momentary button styles.

Presentation Viewer / Media Loading
Slides and thumbnails have explicit loading and failure states. Images are hidden until loaded, then shown; failures swap to fallback messaging instead of broken media.

Presentation Viewer / HTML Slide
HTML slides render in an iframe and are centered/resized to fit the stage. Treat this as a distinct content mode, not just another image state.

Presentation Viewer / Dynamic Backdrop
If enabled, image slides generate a soft backdrop color from sampled image pixels. This is a runtime visual enhancement controlled by Settings.

Presentation Viewer / Controls
Stage controls auto-show on interaction and reposition based on stage space, fullscreen state, and orientation mode. Thumbnail strip can be shown or hidden and behaves differently across portrait/landscape layouts.

Presentation Viewer / Hotspots
Hotspots are JSON-driven tappable regions on image slides. Coordinates are normalized 0..1 against the rendered image, not the whole stage. targetPageId resolves at runtime to another slide in the same deck.

Presentation Viewer / Hotspot Debug
Show hotspot areas is a visual debug/training toggle. It reveals hotspot rectangles, but hotspots remain clickable even when outlines are hidden.

Offline Auth
Offline auth uses shared-secret verification. The strongest token format is encrypted (ode1.), while short tokens are MAC-verified and legacy JWT tokens are HS256-signed. Offline success sets authToken to offline-granted and opens the app using cached/bundled content.

Offline Activity
Offline sessions still log activity immediately. Events are queued locally, Sessions works offline, and the queue syncs later when internet returns.

Sync / Reconnect
When internet returns, the app silently tries to upgrade offline auth to online auth using saved credentials, then POSTs queued events. Sync retries also happen on foreground and periodic polling.

Media Cache
The browser PWA uses managed offline media storage in IndexedDB in addition to normal caching. Media retention and pruning are app-controlled, so the same image component may render from recreated object URLs after restart.

Session Naming
Session titles are generated deterministically from session start weekday, time-of-day bucket, and event-count intensity bucket, then persisted locally so titles remain stable across reloads.