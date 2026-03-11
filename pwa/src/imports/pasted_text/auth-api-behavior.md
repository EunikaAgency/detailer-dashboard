One Detailer authentication and post-login API behavior

This PWA uses real authentication and data hydration. The login screen is not just decorative. After login, the app fetches UI text, account data, product data, and later sync events. The UI must support online, cookie-session, and offline-auth states.

==================================================
1. AUTHENTICATION FLOW
==================================================

Endpoint
POST https://otsukadetailer.site/api/auth/login

Request headers
Content-Type: application/json
x-api-key: <api key>   // optional, only if configured

Request body
{
  "email": "rep.username",
  "username": "rep.username",
  "password": "secret-password"
}

Optional request body when an offline token exists
{
  "email": "rep.username",
  "username": "rep.username",
  "password": "secret-password",
  "createdAt": "2026-03-01T09:30:00.000Z"
}

Sample successful response with bearer token
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NWRjM2EyYmQxMjM0NTY3ODkwYWJjZCIsInVzZXJuYW1lIjoicmVwLnVzZXJuYW1lIn0.signature",
  "method": "password",
  "user": {
    "_id": "65dc3a2bd1234567890abcd",
    "username": "rep.username",
    "issuedLoginUsername": "rep.username",
    "representativeName": "Jane Santos",
    "repId": "REP-2048",
    "role": "Medical Representative",
    "email": "rep.username@company.com"
  }
}

Sample successful response with alternate token field
{
  "accessToken": "eyJhbGciOi...",
  "method": "password",
  "user": {
    "_id": "65dc3a2bd1234567890abcd",
    "username": "rep.username",
    "representativeName": "Jane Santos",
    "repId": "REP-2048",
    "role": "Medical Representative"
  }
}

Sample cookie-session-only success
{
  "success": true,
  "method": "password",
  "user": {
    "_id": "65dc3a2bd1234567890abcd",
    "username": "rep.username",
    "representativeName": "Jane Santos",
    "repId": "REP-2048",
    "role": "Medical Representative"
  }
}

Sample failure response
{
  "error": "Invalid username or password"
}

How the app handles auth responses
- If `token`, `accessToken`, or `access_token` exists:
  store it as the active auth token and treat the user as fully authenticated.
- If `success: true` exists but no token exists:
  store special auth mode `session-cookie-only`.
- If neither token nor success exists:
  show login error state.

UI states Figma should include
- Default login
- Login loading
- Login validation error
- Login API error
- Login success
- Offline success
- Returning user with remembered username

==================================================
2. LOCAL AUTH STATE AFTER LOGIN
==================================================

After successful online login, the app stores:
- `authToken`
- `offlineAuth`
- `offlineSyncCredentials`
- `accountProfile`
- `savedCredentials` if "Remember credentials" is checked

Sample local authToken
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

Sample special auth tokens
"session-cookie-only"
"offline-granted"

Sample savedCredentials
{
  "identifier": "rep.username",
  "password": "secret-password",
  "createdAt": "2026-03-11T08:15:21.000Z"
}

Sample accountProfile
{
  "representativeName": "Jane Santos",
  "username": "rep.username",
  "issuedLoginUsername": "rep.username",
  "userId": "65dc3a2bd1234567890abcd",
  "repId": "REP-2048",
  "role": "Medical Representative"
}

How to handle in UI
- If authToken exists on app start, skip login and go straight to products.
- If authToken is `offline-granted`, still allow app entry.
- If authToken is `session-cookie-only`, user is logged in but some protected API requests may trigger silent refresh.

==================================================
3. MOBILE UI CONFIG FETCH
==================================================

Purpose
This API populates UI labels and text copy across the app.

Endpoint
GET https://otsukadetailer.site/api/mobile-config?account=<account>&api_key=<key>

Request headers
Authorization: Bearer <token>   // if bearer token exists
x-api-key: <api key>            // optional if configured

Sample request
GET /api/mobile-config?account=otsuka-detailer&api_key=demo-key

Sample response
{
  "account": "otsuka-detailer",
  "config": {
    "text": {
      "brandTitle": "One Detailer",
      "loginTitle": "One Detailer",
      "loginSubtitle": "Sign in to continue",
      "loginButton": "Sign in",
      "rememberCredentials": "Remember credentials",
      "productsTitle": "Presentations",
      "searchPlaceholder": "Search presentations",
      "menuTitle": "Menu",
      "settingsTitle": "Settings",
      "advancedSettingsTitle": "Advanced",
      "myAccountTitle": "My Account",
      "sessionsTitle": "Sessions",
      "selectCaseLabel": "Select Case",
      "slideLabel": "Slide",
      "ofLabel": "of",
      "fullscreenButton": "Fullscreen",
      "installAppButton": "Install App"
    }
  }
}

How the app handles it
- Reads `response.config.text`
- Saves it locally with a fetched timestamp
- Reuses cached text for up to 24 hours
- If offline or request fails, keeps the previous cached labels

How to handle in Figma
- Treat visible labels as configurable, not permanently hardcoded
- Add annotation: “copy may be overridden by `/mobile-config`”

==================================================
4. PRODUCTS CONFIG FETCH
==================================================

Purpose
This API populates the gallery, categories, thumbnails, product decks, cases, and slide media.

Endpoint
GET https://otsukadetailer.site/api/products?api_key=<key>

Request headers
Authorization: Bearer <token>   // if bearer token exists
x-api-key: <api key>            // optional if configured

Sample request
GET /api/products?api_key=demo-key

Sample response
{
  "version": 12,
  "products": [
    {
      "_id": "prod-001",
      "name": "Abilify Maintena",
      "category": "Psychiatry",
      "thumbnail": "src/assets/abilify-thumb.jpg",
      "media": [
        {
          "groupId": "abilify-maintena-hcp-overview",
          "title": "HCP Overview",
          "items": [
            {
              "id": "slide-1",
              "type": "image",
              "url": "src/assets/abilify-slide-1.jpg",
              "thumbnailUrl": "src/assets/abilify-slide-1-thumb.jpg",
              "title": "Introduction"
            },
            {
              "id": "slide-2",
              "type": "image",
              "url": "src/assets/abilify-slide-2.jpg",
              "thumbnailUrl": "src/assets/abilify-slide-2-thumb.jpg",
              "title": "Clinical Data",
              "hotspots": [
                {
                  "id": "hs-1",
                  "x": 12,
                  "y": 18,
                  "w": 20,
                  "h": 16,
                  "targetPageId": "src/assets/abilify-slide-5.jpg"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

How the app handles products response
- Uses `products[]` to build the presentation gallery
- Uses unique `category` values to build filter chips
- Uses `thumbnail` / `thumbnailUrl` for gallery cards
- Uses `media[].items[]` to build presentation decks
- Filters out non-renderable items like failed/pending items or PDFs
- Supports image, video, and HTML slides

Fallback behavior
- If remote fetch fails and cached products exist, use cached products
- If remote fetch fails and nothing is cached, use bundled local products.json
- If auth is blocked and no live token is available, app may still show bundled content

How to handle in Figma
Include these states:
- Live loaded gallery
- Gallery loading placeholders
- Gallery using cached fallback
- Gallery auth-blocked but still showing local content
- Gallery hard failure / empty state

==================================================
5. LOGIN EVENTS / SESSION SYNC
==================================================

Purpose
Tracks session and usage events tied to the authenticated or offline user.

Endpoint
POST https://otsukadetailer.site/api/login-events

Request headers
Content-Type: application/json
Authorization: Bearer <token>   // if bearer exists
x-api-key: <api key>            // optional if configured

Sample request body
{
  "userId": "65dc3a2bd1234567890abcd",
  "login": "rep.username",
  "username": "rep.username",
  "issuedLoginUsername": "rep.username",
  "events": [
    {
      "eventType": "auth",
      "action": "login_success",
      "screen": "login",
      "method": "password",
      "source": "online",
      "timestamp": "2026-03-11T08:16:00.000Z"
    },
    {
      "eventType": "activity",
      "action": "screen_view",
      "screen": "products",
      "method": "password",
      "source": "online",
      "timestamp": "2026-03-11T08:16:03.000Z"
    }
  ]
}

Sample response
{
  "success": true
}

How the app handles it
- Sends queued usage events after login or when reconnecting
- If sync fails, keeps the queue locally for retry
- Sessions UI is built from locally tracked activity events

How to handle in Figma
- No dedicated sync screen needed
- Sessions list/detail should feel like a local timeline that may later sync to backend

==================================================
6. TOKEN REFRESH / RETRY
==================================================

If the app tries to call a protected endpoint and current auth is:
- missing
- `offline-granted`
- `session-cookie-only`

then it attempts re-login using saved credentials.

Retry logic
1. Reuse `offlineSyncCredentials` or `savedCredentials`
2. Call `/auth/login` again
3. If new bearer token is returned, retry original request once

How to handle in UI
- Keep transitions smooth
- Avoid showing full-screen login again during silent refresh
- Use subtle loading states if content is delayed
- Do not design flows that assume every API failure sends the user back to login immediately

==================================================
7. OFFLINE LOGIN BEHAVIOR
==================================================

Offline access is supported.

Possible offline success cases
- Password field contains a valid offline credential token
- Stored offline credential matches entered username/password
- Existing offline auth record is still valid

Sample offline local state
{
  "method": "password",
  "username": "rep.username",
  "passwordHash": "4f55ab...",
  "keygenHash": null,
  "repId": "REP-2048",
  "role": "Medical Representative",
  "credentialCreatedAt": "2026-03-01T09:30:00.000Z",
  "grantedAt": 1741670400000,
  "validUntil": 1744262400000
}

How the app handles offline login
- Sets authToken to `offline-granted`
- Builds partial account profile from local/offline payload
- Navigates into products
- Loads cached or bundled products
- Keeps app usable without internet

How to handle in Figma
Include an “offline success” prototype branch where:
- Login succeeds
- Products screen opens
- Some copy or sync actions may be limited
- App still looks intentional, not broken

==================================================
8. MY ACCOUNT POPULATION
==================================================

The My Account screen is populated from `accountProfile`, which is assembled from login response user fields plus the current identifier.

Fields to show
- Representative Name
- Username
- Issued login username
- Rep ID
- Role

If fields are missing
- Leave them blank
- Keep layout stable
- Do not hide the whole card just because one field is missing

==================================================
9. STARTUP HYDRATION
==================================================

On app launch, before rendering:
- read authToken
- read offlineAuth
- read offlineSyncCredentials
- read savedCredentials
- read accountProfile
- read mobileUiConfig
- read products config
- read media cache

How the app behaves
- If auth exists, skip login and open gallery
- If offline auth expired, clear it and return to login
- If cached products exist, render quickly and then refresh remotely in background

How to handle in Figma
Include startup branches for:
- Fresh user lands on login
- Returning user lands directly on gallery
- Returning offline user lands on gallery with cached content
- Boot failure / recovery screen

==================================================
10. ERROR HANDLING RULES
==================================================

For Figma implementation notes, use these rules:

Auth/login errors
- Show inline error near the login form
- Keep entered username
- Do not clear password automatically unless product decides to

Mobile-config failure
- Use cached text if available
- Otherwise keep default built-in labels

Products failure
- If cached or bundled content exists, continue into the app
- If nothing exists, show gallery error state

Session sync failure
- Keep events locally
- Retry later
- Do not block navigation

Boot/startup failure
- Show recovery screen with:
  - Reload app
  - Reset cached data

==================================================
11. RECOMMENDED FIGMA NOTES TO ADD
==================================================

Add these short notes directly in the file:
- “Login POSTs to `/api/auth/login` and can return bearer token, cookie-session success, or failure.”
- “UI text labels can be overridden by `/api/mobile-config`.”
- “Gallery content is driven by `/api/products` with cached/bundled fallback.”
- “My Account fields are populated from login response user data.”
- “Returning users may bypass login entirely if local auth is already present.”
- “Offline login is a valid success path.”
- “Protected requests may silently refresh auth using saved credentials.”
