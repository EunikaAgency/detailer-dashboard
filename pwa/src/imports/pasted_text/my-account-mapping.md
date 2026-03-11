My Account field mapping spec

The My Account screen is a read-only profile view populated from locally stored account data. It does not normally fetch its own API on screen open.

==================================================
1. SOURCE OF DATA
==================================================

Primary source
- `accountProfile` stored in local persistence after login or auth restore

`accountProfile` is assembled from:
- entered login identifier
- login response user object
- restored local auth/account state on startup

This means My Account is derived data, not a standalone backend profile fetch screen.

==================================================
2. LOGIN RESPONSE FIELD MAPPING
==================================================

After successful login, the app builds `accountProfile` from the response user payload.

Source login response example
{
  "token": "<bearer token>",
  "user": {
    "_id": "65dc3a2bd1234567890abcd",
    "username": "rep.username",
    "email": "rep.username@company.com",
    "issuedLoginUsername": "rep.username",
    "representativeName": "Jane Santos",
    "repName": "Jane Santos",
    "fullName": "Jane Santos",
    "name": "Jane Santos",
    "repId": "REP-2048",
    "repID": "REP-2048",
    "representativeId": "REP-2048",
    "role": "Medical Representative"
  }
}

Mapped output rules

A. Representative Name
Mapped from first available:
- `user.representativeName`
- `user.repName`
- `user.fullName`
- `user.name`
- else `""`

B. Username
Mapped from first available:
- `user.username`
- `user.email`
- else normalized login identifier

C. Issued login username
Mapped from:
- normalized identifier entered during login

D. User ID
Mapped from first available:
- `user.userId`
- `user._id`
- `user.id`
- else `""`

E. Rep ID
Mapped from first available:
- `user.repId`
- `user.repID`
- `user.representativeId`
- else `""`

F. Role
Mapped from:
- `user.role`
- else `""`

==================================================
3. RESULTING ACCOUNT PROFILE OBJECT
==================================================

Example stored accountProfile
{
  "representativeName": "Jane Santos",
  "username": "rep.username",
  "issuedLoginUsername": "rep.username",
  "userId": "65dc3a2bd1234567890abcd",
  "repId": "REP-2048",
  "role": "Medical Representative"
}

==================================================
4. WHAT THE MY ACCOUNT SCREEN DISPLAYS
==================================================

Displayed read-only fields
- Representative Name
- Username
- Issued login username
- Rep ID
- Role

These are rendered as read-only field rows, not editable form inputs.

Important
- values may be partial
- blank values should still preserve layout
- the screen should not collapse or hide if one or more fields are empty

==================================================
5. STARTUP / FALLBACK POPULATION
==================================================

On startup, the app restores `accountProfile` from local storage.

If some values are missing, the app can also infer fallback identity values from:
- saved credentials identifier
- offline sync credentials identifier
- offline auth username
- active session identifier

This helps preserve user identity display even when the backend did not provide all fields.

Fallback example
- if `issuedLoginUsername` is missing:
  use normalized saved identifier
- if `username` is missing:
  use same normalized identifier
- if `userId` is missing:
  attempt to resolve from current auth token payload

==================================================
6. OFFLINE LOGIN BEHAVIOR
==================================================

When offline login succeeds, My Account may still be partially populated from offline credential payload or existing local state.

Possible offline-derived fields
- representativeName
- username
- issuedLoginUsername
- userId
- repId
- role

Important
Offline mode should not make My Account look broken.
It may just show fewer populated fields.

==================================================
7. WHAT MY ACCOUNT IS NOT
==================================================

This screen is not:
- an editable profile form
- a live profile API editor
- a settings form
- a permissions management screen

It is a read-only identity summary for the currently active user context.

==================================================
8. WHAT FIGMA SHOULD SHOW
==================================================

Create these variants:

1. Fully populated account card
- all five fields filled

2. Partially populated account card
- some fields blank but layout intact

3. Offline-restored account state
- username / issued login username present
- representativeName / repId / role may be partial

Recommended annotation
“My Account is populated from locally stored `accountProfile`, which is mapped from login response user fields and current identifier. It is a read-only identity summary, not a standalone profile-edit screen.”
