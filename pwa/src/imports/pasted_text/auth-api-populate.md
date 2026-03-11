Authentication and API population for One Detailer

This app is not a static login mock. The login screen, app labels, account fields, product gallery, and some sync behavior are populated from live API calls and cached local state.

AUTH ENTRY FLOW

1. Login form fields
- Username field
- Password field
- Remember credentials checkbox

2. Login request
POST /api/auth/login
Base URL:
- Production: https://otsukadetailer.site/api
- Local dev may proxy through /api

Request body:
{
  "email": "<identifier>",
  "username": "<identifier>",
  "password": "<password>"
}

Optional:
- createdAt may also be sent when an offline credential token exists

3. Login response expectations
Preferred response:
{
  "token": "...jwt or bearer token...",
  "method": "password",
  "user": { ...user fields... }
}

Also supported:
- accessToken
- access_token

Cookie-only fallback response:
{
  "success": true,
  "method": "password",
  "user": { ...user fields... }
}

If success=true but no token is returned, the app stores a special auth mode called:
- session-cookie-only

4. Auth storage after successful online login
Persist to local storage:
- authToken
- offlineAuth
- offlineSyncCredentials
- accountProfile
- savedCredentials if remember is checked

5. Auth states for UI
The UI should support these login result states:
- loading: sign-in button disabled, label changes to “Signing you in...”
- validation error: missing username/password
- online success
- offline success
- login failed with inline error banner

AUTH MODES

There are 3 auth modes in the app:

1. Bearer token mode
- Standard online authenticated state
- Authorization header is sent as:
  Authorization: Bearer <token>

2. Cookie-only session mode
- Returned if backend authenticates via cookie session but does not return a token
- Stored as special token value:
  session-cookie-only
- UI should still treat this as authenticated
- But protected data calls may need refresh/login retry behavior

3. Offline auth mode
- Stored as special token value:
  offline-granted
- Lets the user into the app without live API access if offline validation succeeds
- Important for prototypes: the app can still open products using cached/bundled content even without internet

ACCOUNT PROFILE POPULATION

After login, build accountProfile from the login response user object.

The UI for My Account should expect these mapped fields:
- representativeName
- username
- issuedLoginUsername
- userId
- repId
- role

These values are sourced from login response user data plus the typed identifier.

The My Account screen should display read-only fields for:
- Representative Name
- Username
- Issued login username
- Rep ID
- Role

POST-LOGIN DATA FETCHES

After successful authenticated session setup, the app fetches and/or hydrates these data sources:

1. Mobile UI config
GET /api/mobile-config?account=<account>

Purpose:
- supplies dynamic UI text labels and copy
- used to populate labels like button text, headings, login copy, gallery labels, etc.

Expected shape:
{
  "config": {
    "text": {
      "loginTitle": "...",
      "loginSubtitle": "...",
      "productsTitle": "...",
      "settingsTitle": "...",
      ...
    }
  },
  "account": "..."
}

Behavior:
- cached locally for 24 hours
- if offline, cached text is reused
- if fetch fails, existing cached text remains active

Design implication:
Figma should annotate that visible labels are API-configurable and not always hardcoded.

2. Products config
GET /api/products
Sent from config base:
- production config base is https://otsukadetailer.site
- full route resolves to https://otsukadetailer.site/api/products

May include API key in query string:
- api_key=<key>

Used to populate:
- gallery cards
- categories
- thumbnails
- case selection
- slide decks
- media references

Behavior:
- remote live config is preferred
- cached or bundled config is used as fallback
- if auth/API fails, UI may still show bundled content

Design implication:
Figma should include these gallery states:
- live loaded
- loading placeholders
- auth-blocked / fallback content
- empty or failed state

3. Login events sync
POST /api/login-events

Purpose:
- send usage / tracking events after login or during app use

Payload includes:
{
  "userId": "...",
  "login": "...",
  "username": "...",
  "issuedLoginUsername": "...",
  "events": [...]
}

Design implication:
No dedicated UI needed, but note that sessions and usage tracking are tied to authenticated identity.

TOKEN REFRESH / RETRY BEHAVIOR

Some requests require an online bearer token.
If the app only has:
- offline-granted
- session-cookie-only
- missing token

then it tries to refresh by reusing saved credentials and calling /auth/login again.

If a request fails with 401 or 403:
- app retries login with saved credentials
- then retries the original request once

Design implication:
Figma should account for brief loading states after login and during recovery, especially:
- initial login
- post-login content refresh
- silent retry before protected data loads

OFFLINE / FALLBACK AUTH BEHAVIOR

The app supports offline entry in these cases:
- a valid offline credential token is entered as the password
- a stored offline auth record matches the entered username/password
- in debug/dev only, an unsafe bypass may exist

If offline login succeeds:
- authToken becomes offline-granted
- user still enters the app
- products load from cached/bundled config
- account profile is partially populated from offline token payload or prior local data

Design implication:
Figma should not assume login failure always blocks the app.
The app can continue into a reduced but usable offline experience.

LOCAL CACHING / HYDRATION

On app startup, before showing login or products, hydrate from local storage:
- authToken
- offlineAuth
- offlineSyncCredentials
- savedCredentials
- accountProfile
- mobileUiConfig
- products config
- media cache / media metadata

If authToken exists:
- route opens directly into products
- active session is restored or created
- login screen is skipped

Design implication:
Include startup states where the app opens directly into the gallery without showing login again.

SCREEN-SPECIFIC DATA NOTES FOR FIGMA

Login screen
- labels can be overridden by mobile-config text
- remembered username may prefill the username field
- password is not prefilled
- inline error appears above buttons
- loading state changes primary CTA text

Gallery screen
- populated from products config API or fallback bundled config
- category chips generated from product categories
- product thumbnails can come from cached media or remote URLs

Menu / Settings / Sessions
- shell is available after any authenticated mode
- install button is conditional based on PWA install state, not auth

My Account
- uses accountProfile from login response and local persistence
- fields are read-only

Sessions
- session/event identity is tied to authenticated or offline user context

RECOMMENDED FIGMA ANNOTATIONS

Add implementation notes to the file saying:
- “UI copy is partially driven by /mobile-config”
- “Authenticated state can be bearer token, cookie session, or offline-granted”
- “Gallery content is driven by /api/products with cached/bundled fallback”
- “My Account fields come from login response user payload”
- “App may bypass login on startup if auth state is already persisted”
- “Offline login path exists and should have a valid success state”

If needed, create these prototype branches:
- Online login success
- Offline login success
- Login failure
- Returning user auto-login via persisted auth
- Products loading from live API
- Products loading from cached fallback
