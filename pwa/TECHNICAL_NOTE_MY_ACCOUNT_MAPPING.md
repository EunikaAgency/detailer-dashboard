# Technical Note: My Account Field Mapping

**For:** One Detailer PWA  
**Date:** March 11, 2026  
**Context:** My Account screen field population and fallback logic

---

## 🎯 Quick Summary

The **My Account** screen is a **read-only profile view** populated from locally stored account data. It does **NOT** fetch its own API on screen open. Instead, it displays data from `accountProfile`, which is assembled during login from the login response user object and the entered login identifier. This note explains the complete field mapping logic, fallback chains, and offline behavior.

---

## 1️⃣ Data Source

### **Primary Source**

**`accountProfile`** stored in `localStorage` after:
- Successful online login
- Successful offline login
- Auth restoration on app startup

### **How accountProfile is Assembled**

`accountProfile` is built from:
1. **Entered login identifier** (username/email entered by user)
2. **Login response user object** (from `/api/auth/login`)
3. **Restored local auth/account state** (on startup)

### **Important Distinction**

My Account is **derived data**, not a standalone backend profile fetch screen.

**It displays what was stored during login, not live backend data.**

---

## 2️⃣ Account Profile Object Schema

### **TypeScript Interface**

```typescript
export interface AccountProfile {
  representativeName?: string;
  username: string;
  issuedLoginUsername?: string;
  userId: string;
  repId?: string;
  role?: string;
}
```

### **Example Stored accountProfile**

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

---

## 3️⃣ Login Response Structure

### **Example Login Response**

```json
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
```

### **Possible Field Variations**

Different backend implementations may return different field names. The mapping logic handles all common variations.

---

## 4️⃣ Field Mapping Rules

### **A. Representative Name**

**Display Label:** `Representative Name`

**Mapped from first available:**

```typescript
user.representativeName || 
user.repName || 
user.fullName || 
user.name || 
''
```

**Fallback chain:**
1. `user.representativeName`
2. `user.repName`
3. `user.fullName`
4. `user.name`
5. `''` (empty string)

**Example:**
```json
// If response has:
{ "user": { "repName": "Jane Santos" } }

// Result:
{ "representativeName": "Jane Santos" }
```

---

### **B. Username**

**Display Label:** `Username`

**Mapped from first available:**

```typescript
user.username || 
user.email || 
identifier
```

**Fallback chain:**
1. `user.username`
2. `user.email`
3. **normalized login identifier** (what the user typed during login)

**Example:**
```json
// If response has:
{ "user": { "email": "rep.username@company.com" } }

// And user typed: "rep.username"

// Result:
{ "username": "rep.username@company.com" }

// But if no username/email in response:
{ "username": "rep.username" }
```

**Important:** The fallback to `identifier` ensures the username field is always populated, even if the backend doesn't return it.

---

### **C. Issued Login Username**

**Display Label:** `Issued login username`

**Mapped from:**

```typescript
identifier  // The normalized identifier entered during login
```

**This is NOT from the API response.** It's the actual username/email the user typed into the login form.

**Purpose:** Shows exactly what credential was used to authenticate, separate from the backend-returned username.

**Example:**
```json
// User typed: "rep.username"
// Result:
{ "issuedLoginUsername": "rep.username" }
```

---

### **D. User ID**

**Display Label:** (not displayed separately, used for API calls)

**Mapped from first available:**

```typescript
user.userId || 
user._id || 
user.id || 
''
```

**Fallback chain:**
1. `user.userId`
2. `user._id` (MongoDB-style ID)
3. `user.id`
4. `''` (empty string)

**Example:**
```json
// If response has:
{ "user": { "_id": "65dc3a2bd1234567890abcd" } }

// Result:
{ "userId": "65dc3a2bd1234567890abcd" }
```

---

### **E. Rep ID**

**Display Label:** `Rep ID`

**Mapped from first available:**

```typescript
user.repId || 
user.repID || 
user.representativeId || 
''
```

**Fallback chain:**
1. `user.repId` (lowercase 'd')
2. `user.repID` (uppercase 'D')
3. `user.representativeId`
4. `''` (empty string)

**Example:**
```json
// If response has:
{ "user": { "repID": "REP-2048" } }

// Result:
{ "repId": "REP-2048" }
```

---

### **F. Role**

**Display Label:** `Role`

**Mapped from:**

```typescript
user.role || ''
```

**Example:**
```json
// If response has:
{ "user": { "role": "Medical Representative" } }

// Result:
{ "role": "Medical Representative" }
```

---

## 5️⃣ My Account Screen Display

### **Read-Only Fields**

The My Account screen displays **5 read-only fields**:

1. **Representative Name** - `{profile.representativeName || '—'}`
2. **Username** - `{profile.username || '—'}`
3. **Issued login username** - `{profile.issuedLoginUsername || '—'}`
4. **Rep ID** - `{profile.repId || '—'}`
5. **Role** - `{profile.role || '—'}`

### **Visual Treatment**

Each field is rendered as:
- **Label:** Small, medium-weight, slate-600 text
- **Value:** Larger, slate-900 text in a muted background field (read-only, not editable)
- **Empty state:** Shows `—` (em dash) if value is missing

**Example HTML Structure:**

```tsx
<div>
  <label className="block text-xs font-medium text-slate-600 mb-1.5">
    Representative Name
  </label>
  <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
    {profile.representativeName || '—'}
  </div>
</div>
```

### **Important Layout Rule**

**Blank values should still preserve layout.**

The screen should **NOT collapse or hide** if one or more fields are empty. All 5 fields are always displayed, even if some show `—`.

---

## 6️⃣ Startup and Fallback Population

### **On App Startup**

The app restores `accountProfile` from `localStorage`:

```typescript
export function getAccountProfile(): AccountProfile | null {
  const profile = localStorage.getItem('accountProfile');
  return profile ? JSON.parse(profile) : null;
}
```

### **Fallback Inference**

If some values are missing, the app can infer fallback identity values from:
- Saved credentials identifier
- Offline sync credentials identifier
- Offline auth username
- Active session identifier

**Purpose:** Helps preserve user identity display even when the backend did not provide all fields.

**Example Fallback Logic:**

```typescript
// If issuedLoginUsername is missing:
// Use normalized saved identifier

// If username is missing:
// Use same normalized identifier

// If userId is missing:
// Attempt to resolve from current auth token payload
```

---

## 7️⃣ Offline Login Behavior

### **When Offline Login Succeeds**

My Account may be **partially populated** from:
- Offline credential payload
- Existing local state

### **Possible Offline-Derived Fields**

```typescript
const accountProfile: AccountProfile = {
  representativeName: payload.name,          // from credential
  username: payload.username,                // from credential
  issuedLoginUsername: payload.username,     // from credential
  userId: payload.userId || 'offline-' + payload.username,
  repId: payload.repId,                      // from credential
  role: payload.role,                        // from credential
};
```

### **Important: Offline Should Not Look Broken**

**Offline mode should not make My Account look broken.**

It may just show **fewer populated fields**, but the layout remains intact with `—` for missing values.

---

## 8️⃣ Implementation Details

### **File Location**

**Authentication Logic:** `/src/app/lib/auth.ts`  
**Account Screen:** `/src/app/screens/account.tsx`

### **Key Function: buildAccountProfile**

```typescript
function buildAccountProfile(
  loginResponse: LoginResponse, 
  identifier: string
): AccountProfile {
  const { user } = loginResponse;
  
  // A. Representative Name - fallback chain
  const representativeName = 
    user.representativeName || 
    user.repName || 
    user.fullName || 
    user.name || 
    '';
  
  // B. Username - fallback chain
  const username = 
    user.username || 
    user.email || 
    identifier;
  
  // C. Issued login username - normalized identifier
  const issuedLoginUsername = identifier;
  
  // D. User ID - fallback chain
  const userId = 
    user.userId || 
    user._id || 
    user.id || 
    '';
  
  // E. Rep ID - fallback chain
  const repId = 
    user.repId || 
    user.repID || 
    user.representativeId || 
    '';
  
  // F. Role
  const role = user.role || '';
  
  return {
    representativeName,
    username,
    issuedLoginUsername,
    userId,
    repId,
    role,
  };
}
```

### **When This Function is Called**

```typescript
function storeAuthData(
  loginResponse: LoginResponse,
  identifier: string,
  password: string,
  rememberCredentials: boolean
) {
  // Build and store account profile
  const accountProfile = buildAccountProfile(loginResponse, identifier);
  localStorage.setItem('accountProfile', JSON.stringify(accountProfile));
  
  // ... rest of auth storage
}
```

---

## 9️⃣ What My Account Is NOT

### **This Screen is NOT:**

❌ **An editable profile form** - fields are read-only  
❌ **A live profile API editor** - no API calls on screen open  
❌ **A settings form** - separate Settings screen exists  
❌ **A permissions management screen** - role is displayed, not edited

### **This Screen IS:**

✅ **A read-only identity summary** for the currently active user context  
✅ **A local data display** from stored `accountProfile`  
✅ **A troubleshooting reference** to verify login identity

---

## 🔟 Figma Design Variants

### **Required Variants**

#### **1. Fully Populated Account Card**

All five fields filled with realistic data:

```
Representative Name:  Jane Santos
Username:             rep.username
Issued login username: rep.username
Rep ID:               REP-2048
Role:                 Medical Representative
```

---

#### **2. Partially Populated Account Card**

Some fields blank but layout intact:

```
Representative Name:  Jane Santos
Username:             rep.username
Issued login username: rep.username
Rep ID:               —
Role:                 —
```

**Key Design Requirement:** Empty fields show `—` (em dash), not collapsed/hidden

---

#### **3. Offline-Restored Account State**

Username and issued login username present, other fields may be partial:

```
Representative Name:  —
Username:             rep.username
Issued login username: rep.username
Rep ID:               —
Role:                 —
```

**Annotation:** This state represents offline login where only minimal credential data is available.

---

### **Visual Design Specifications**

**Field Container:**
- Background: `bg-slate-50`
- Border: `border border-slate-200`
- Padding: `px-3 py-2.5`
- Border radius: `rounded-lg`
- Text color: `text-slate-900`

**Label:**
- Font size: `text-xs`
- Font weight: `font-medium`
- Text color: `text-slate-600`
- Margin bottom: `mb-1.5`

**Empty State Value:**
- Display: `—` (em dash, U+2014)
- Same styling as populated value

---

## 1️⃣1️⃣ User Flow

### **Login Flow → My Account Population**

```
User Opens App
  ↓
Login Screen
  ↓
User Enters:
  - Identifier: "rep.username"
  - Password: "••••••••"
  ↓
Login API Call
  ↓
API Response:
  {
    "token": "...",
    "user": {
      "_id": "65dc3a2bd1234567890abcd",
      "representativeName": "Jane Santos",
      "repId": "REP-2048",
      "role": "Medical Representative"
    }
  }
  ↓
buildAccountProfile() Called:
  - representativeName: "Jane Santos" (from user.representativeName)
  - username: "rep.username" (fallback to identifier)
  - issuedLoginUsername: "rep.username" (from identifier)
  - userId: "65dc3a2bd1234567890abcd" (from user._id)
  - repId: "REP-2048" (from user.repId)
  - role: "Medical Representative" (from user.role)
  ↓
accountProfile Stored in localStorage
  ↓
User Navigates to My Account
  ↓
My Account Screen Reads from localStorage
  ↓
Displays All 5 Fields (read-only)
```

---

## 1️⃣2️⃣ Edge Cases

### **Case 1: Backend Returns Minimal User Object**

**API Response:**
```json
{
  "token": "abc123",
  "user": {
    "_id": "65dc3a2bd1234567890abcd"
  }
}
```

**Entered Identifier:** `rep.username`

**Resulting accountProfile:**
```json
{
  "representativeName": "",
  "username": "rep.username",       // fallback to identifier
  "issuedLoginUsername": "rep.username",
  "userId": "65dc3a2bd1234567890abcd",
  "repId": "",
  "role": ""
}
```

**My Account Display:**
```
Representative Name:  —
Username:             rep.username
Issued login username: rep.username
Rep ID:               —
Role:                 —
```

---

### **Case 2: Offline Login with No Cached User Data**

**Scenario:** User logs in offline using offline credential token

**Resulting accountProfile:**
```json
{
  "representativeName": "Jane Santos",  // from credential payload
  "username": "rep.username",
  "issuedLoginUsername": "rep.username",
  "userId": "offline-rep.username",
  "repId": "REP-2048",
  "role": "Medical Representative"
}
```

**Note:** Offline credential tokens can include full user metadata.

---

### **Case 3: Session Restoration on App Startup**

**Scenario:** User previously logged in, closes app, reopens app

**Flow:**
1. App startup runs auth check
2. Reads `accountProfile` from `localStorage`
3. My Account screen displays cached data
4. No new API call required

**This is why My Account is "derived data" - it persists across sessions.**

---

## 1️⃣3️⃣ Testing Checklist

### **Test Scenarios**

- [ ] **Fully populated response** - all fields display correctly
- [ ] **Minimal response** - fallbacks work, layout doesn't break
- [ ] **Username fallback** - identifier used when `user.username` missing
- [ ] **RepId variation** - handles `repId`, `repID`, `representativeId`
- [ ] **Name variation** - handles `representativeName`, `repName`, `fullName`, `name`
- [ ] **Offline login** - partial data displays cleanly
- [ ] **Empty field rendering** - shows `—` not blank/collapsed
- [ ] **Session restoration** - cached profile displays on app reopen
- [ ] **Logout behavior** - profile cleared, My Account shows "No account information available"

---

## 1️⃣4️⃣ Related Documentation

- **`/src/imports/pasted_text/my-account-mapping.md`** - Original specification
- **`/src/app/lib/auth.ts`** - Authentication and profile mapping implementation
- **`/src/app/screens/account.tsx`** - My Account screen component
- **`/IMPLEMENTATION_PRINCIPLES.md`** - Overall app architecture
- **`/SESSIONS_SPECIFICATION.md`** - Activity session tracking

---

## 1️⃣5️⃣ Recommended Figma Annotation

```
"My Account is populated from locally stored `accountProfile`, 
which is mapped from login response user fields using fallback 
chains for field name variations. It is a read-only identity 
summary, not a standalone profile-edit screen. Fields may be 
partially populated (showing '—') but layout is always preserved."
```

---

## 1️⃣6️⃣ Field Mapping Summary Table

| Display Label | Priority 1 | Priority 2 | Priority 3 | Priority 4 | Fallback |
|---------------|-----------|-----------|-----------|-----------|----------|
| **Representative Name** | `user.representativeName` | `user.repName` | `user.fullName` | `user.name` | `''` |
| **Username** | `user.username` | `user.email` | `identifier` | — | — |
| **Issued login username** | `identifier` | — | — | — | — |
| **User ID** | `user.userId` | `user._id` | `user.id` | — | `''` |
| **Rep ID** | `user.repId` | `user.repID` | `user.representativeId` | — | `''` |
| **Role** | `user.role` | — | — | — | `''` |

---

## 1️⃣7️⃣ API Response Field Coverage

### **All Supported Field Names in LoginResponse.user**

```typescript
{
  // User ID variations
  _id?: string;
  id?: string;
  userId?: string;
  
  // Username variations
  username?: string;
  email?: string;
  
  // Login identifier
  issuedLoginUsername?: string;
  
  // Representative name variations
  representativeName?: string;
  repName?: string;
  fullName?: string;
  name?: string;
  
  // Rep ID variations
  repId?: string;
  repID?: string;
  representativeId?: string;
  
  // Role
  role?: string;
}
```

**Coverage:** 15 possible field names mapped to 6 accountProfile fields

---

**End of Technical Note**  
*My Account Field Mapping*  
*March 11, 2026*
