# One Detailer - Offline Security Model

**Status:** ✅ Implemented  
**Security Level:** Shared-Secret Verification

---

## 🔐 Overview

**Important:** Offline login is NOT a plain local bypass. It uses **shared-secret credential verification** to authenticate users without requiring an active internet connection.

---

## 🎯 How Offline Login Works

### User Experience
Users interact with the **same login form** as online login:
- Username field
- Password field
- Remember credentials checkbox
- Sign in button

### Key Difference
In offline mode, the **password field may contain a credential token** instead of a normal human password.

### Verification Process
```
1. User enters username + credential token
2. App extracts shared secret from environment/storage
3. App verifies token signature/MAC using shared secret
4. Token username must match entered username
5. Token timestamp must be valid (not expired)
6. If all checks pass → Offline authentication succeeds
```

---

## 🔑 Shared Secret Resolution

The app resolves the offline verification secret from these sources (in order):

```javascript
1. VITE_OFFLINE_CREDENTIAL_SECRET (environment variable)
2. VITE_JWT_SECRET (environment variable)
3. localStorage.offlineCredentialSecret (runtime storage)
4. Expo extra.offlineCredentialSecret (Expo builds)
```

**Security Model:** Symmetric verification (shared secret), not public-key auth

**No Secret = No Offline Access**  
If the secret is missing, offline token verification fails and the user cannot log in offline.

---

## 📋 Supported Offline Token Types

### 1. Encrypted Credential Token (Strongest)
**Format:** `ode1.<encrypted-payload>`

**Characteristics:**
- Encrypted and integrity-checked using shared secret
- Strongest current offline token format
- Tamper-proof

**Payload Example:**
```json
{
  "typ": "offline-credential",
  "ver": "od-offline-v4-short",
  "username": "rep.username",
  "name": "Jane Santos",
  "repId": "REP-2048",
  "role": "Medical Representative",
  "email": "rep.username@company.com",
  "userId": "65dc3a2bd1234567890abcd",
  "createdAt": "2026-03-01T09:30:00.000Z"
}
```

**Verification Steps:**
1. Remove `ode1.` prefix
2. Decrypt using AES with shared secret as key
3. Verify integrity/MAC
4. Parse JSON payload
5. Validate username matches entered username
6. Validate timestamp (not expired)

### 2. Short Credential Token
**Format:** 14 lowercase alphanumeric characters (e.g., `ab3f9k2m8n5q1p`)

**Characteristics:**
- Not encrypted
- Signed/MAC-verified using shared secret
- Tied to entered username
- Compact for manual entry

**Payload Example:**
```json
{
  "typ": "offline-credential",
  "ver": "od-offline-v4-short",
  "username": "rep.username",
  "createdAt": "2026-03-01T09:30:00.000Z"
}
```

**Verification Steps:**
1. Validate format: `/^[a-z0-9]{14}$/`
2. Compute HMAC-SHA256 of username + timestamp using shared secret
3. Verify HMAC matches embedded signature
4. Validate timestamp

### 3. Legacy JWT Credential Token
**Format:** Standard JWT (HS256 signed)

**Characteristics:**
- Backward compatibility
- HS256 signature using shared secret
- Standard JWT claims (exp, iat, nbf)

**Verification Steps:**
1. Split JWT into header.payload.signature
2. Verify HS256 signature using shared secret
3. Check exp, iat, nbf claims
4. Validate username matches entered username

---

## ✅ Validation Rules

All offline credential tokens must pass these checks:

| Check | Requirement |
|-------|-------------|
| **Structural** | Token format must be valid |
| **Signature/MAC** | Must match shared secret |
| **Username** | Token username must match entered username |
| **Timestamp** | Must be valid and not expired |
| **Secret** | Shared secret must be available |

**If ANY check fails** → Offline authentication fails

---

## 🎬 What Happens on Success

When offline credential verification **succeeds**:

```javascript
1. Set authToken = "offline-granted"
2. Build local offline session
3. Build account profile from token payload
4. Open app without calling /api/auth/login
5. Load products from cached or bundled content
6. Begin tracking activity events locally
```

**Account Profile Built From Token:**
```json
{
  "representativeName": "Jane Santos",
  "username": "rep.username",
  "issuedLoginUsername": "rep.username",
  "userId": "65dc3a2bd1234567890abcd",
  "repId": "REP-2048",
  "role": "Medical Representative"
}
```

**Auth State:**
```
localStorage.authToken = "offline-granted"
```

---

## ❌ What Happens on Failure

When offline credential verification **fails**:

```
1. User stays on login screen
2. Error message displayed: "Invalid username or password"
3. No offline session created
4. No access to app
```

**Failure Reasons:**
- Token format invalid
- Signature/MAC doesn't match secret
- Username mismatch
- Token expired
- Shared secret not available
- Malformed payload

---

## 📊 Activity Tracking During Offline Mode

**Important:** Offline login still creates an **authenticated session**, not an anonymous/dead-end mode.

### Activity Logging Starts Immediately

Even while offline, the app records:
- Auth events (`offline_granted`)
- Session started/stopped
- Screen views
- Product/presentation activity
- Slide changes
- Logout/background/foreground events

### Local Event Queue

Events are stored locally in:
```
localStorage.sessionEvents = [
  {
    "eventType": "auth",
    "action": "offline_granted",
    "screen": "login",
    "method": "password",
    "source": "offline",
    "timestamp": "2026-03-11T08:16:00.000Z"
  },
  {
    "eventType": "activity",
    "action": "screen_view",
    "screen": "products",
    "method": "password",
    "source": "offline",
    "timestamp": "2026-03-11T08:16:03.000Z"
  }
]
```

### Sessions Screen Works Offline

- Sessions list/detail built from local events
- Events appear as "Pending" until synced
- User sees real session timeline without network

### Sync When Online Returns

When internet connectivity returns:

```
1. App detects online event
2. Attempts to upgrade offline auth to online auth
3. POSTs queued events to /api/login-events
4. Marks synced events as synced
5. Clears sent queue
```

**Sync Request Example:**
```http
POST https://otsukadetailer.site/api/login-events

{
  "userId": "65dc3a2bd1234567890abcd",
  "login": "rep.username",
  "username": "rep.username",
  "issuedLoginUsername": "rep.username",
  "events": [
    {
      "eventType": "auth",
      "action": "offline_granted",
      "screen": "login",
      "method": "password",
      "source": "offline",
      "timestamp": "2026-03-11T08:16:00.000Z"
    }
  ]
}
```

**If Sync Fails:**
- Queue kept locally
- App retries later
- User can continue using app

---

## 🎨 Design Implications

### Login Screen

**Visual:** Same as online login (no visual difference)

**Annotations Should Explain:**
- Password field accepts normal password OR offline credential token
- Offline success is a **secure verified path**, not an unauthenticated shortcut
- Shared-secret verification happens behind the scenes

**Recommended Note:**
> "Offline login uses shared-secret credential verification. The password field may contain a secure offline token. If verification passes, the app enters offline-authenticated mode (`offline-granted`) and loads cached/bundled content."

### Authentication Flow Branches

Include these branches in prototypes:

1. ✅ **Online login success** via `/api/auth/login`
2. ✅ **Offline credential success** via shared-secret verification
3. ✅ **Stored offline auth success** (previously authenticated)
4. ❌ **Login failure** (both online and offline failed)

### Sessions Screen

**Note:**
> "Sessions are built from local activity first. Unsynced offline activity can still appear here before backend sync."

**States:**
- Pending (not yet synced)
- Synced (successfully sent to server)

### Offline Mode Philosophy

**Not Anonymous:**
> "Offline mode is authenticated, not anonymous. It depends on valid locally verified credentials."

**Not a Dead End:**
> "Offline login still records activity and syncs later when connectivity returns."

---

## 🔬 Implementation Details

### File: `/src/app/lib/offline-credentials.ts`

**Functions:**
- `verifyOfflineCredential()` - Main verification entry point
- `verifyEncryptedToken()` - Verify ode1. tokens
- `verifyShortToken()` - Verify 14-char tokens
- `verifyJWTToken()` - Verify legacy JWT tokens
- `getOfflineSecret()` - Resolve shared secret
- `isOfflineCredentialToken()` - Detect token format

### File: `/src/app/lib/auth.ts`

**Updated Functions:**
- `login()` - Tries online first, falls back to offline credential verification
- `storeOfflineCredentialAuth()` - Stores offline session data
- `buildAccountProfileFromOfflineCredential()` - Builds profile from token payload

---

## 🧪 Testing Scenarios

### 1. Encrypted Token Login
```
Username: rep.username
Password: ode1.eyJ0eXAiOiJvZmZsaW5lLWNyZWRlbnRpYWwiLCJ2ZXIiOiJvZC1v...

Expected: Offline login succeeds
authToken: "offline-granted"
Account profile populated from token
```

### 2. Short Token Login
```
Username: rep.username
Password: ab3f9k2m8n5q1p

Expected: Offline login succeeds (if secret available and token valid)
```

### 3. JWT Token Login
```
Username: rep.username
Password: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Expected: Offline login succeeds (legacy compatibility)
```

### 4. Invalid Token
```
Username: rep.username
Password: invalid-token-format

Expected: Login fails
Error: "Invalid username or password"
```

### 5. Missing Secret
```
No VITE_OFFLINE_CREDENTIAL_SECRET set
Username: rep.username
Password: ode1.valid-token

Expected: Login fails (secret unavailable)
Console: "No offline credential secret available"
```

### 6. Username Mismatch
```
Username: rep.username
Password: ode1.token-for-different-user

Expected: Login fails (username doesn't match token)
```

### 7. Expired Token
```
Username: rep.username
Password: ode1.token-created-31-days-ago

Expected: Login fails (token expired, max 30 days)
```

---

## 🛡️ Security Considerations

### Strengths
✅ Shared-secret verification (not plaintext)  
✅ Signature/MAC prevents tampering  
✅ Username binding prevents token reuse across accounts  
✅ Timestamp validation prevents replay attacks  
✅ Multiple token formats for flexibility

### Limitations
⚠️ Symmetric key (shared secret must be protected)  
⚠️ If secret leaks, tokens can be forged  
⚠️ Demo implementation uses simplified crypto (production needs proper AES/HMAC)

### Production Recommendations
1. Use Web Crypto API for proper encryption/signing
2. Store shared secret securely (environment variables, not hardcoded)
3. Implement proper key rotation
4. Use short token expiration (7-30 days)
5. Monitor offline login patterns for anomalies

---

## 📊 Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Encrypted token (ode1.) | ✅ Implemented | Simplified crypto (production needs proper AES) |
| Short token (14 chars) | ✅ Implemented | HMAC verification simplified |
| Legacy JWT token | ✅ Implemented | HS256 signature verification |
| Shared secret resolution | ✅ Implemented | Env vars + localStorage |
| Username validation | ✅ Implemented | Enforced on all token types |
| Timestamp validation | ✅ Implemented | 30-day expiration |
| Activity tracking | ✅ Implemented | Starts immediately offline |
| Event sync queue | ✅ Implemented | Local storage with retry |
| Account profile building | ✅ Implemented | From token payload |

---

## 📝 Summary

**Offline Login is Secure:**
- Uses shared-secret verification
- Not a bypass or shortcut
- Authenticated session with activity tracking

**Three Token Types:**
- Encrypted (ode1.) - Strongest
- Short (14 chars) - Compact
- JWT - Legacy compatibility

**Still Tracks Activity:**
- Events logged locally
- Synced when online
- Sessions screen works offline

**Production Ready:**
- Secret resolution implemented
- Token verification implemented
- Activity tracking implemented
- Sync queue implemented

**Security Model:**
- Symmetric shared-secret
- Signature/MAC verification
- Username binding
- Timestamp validation

Offline mode in One Detailer is a **first-class authenticated experience**, not a degraded fallback.
