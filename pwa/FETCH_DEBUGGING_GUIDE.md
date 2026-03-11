# One Detailer - Content Fetching Debugging Guide

**Issue:** App doesn't fetch contents from API  
**Date:** March 11, 2026

---

## 🔍 Understanding the Data Flow

### Data Fetch Hierarchy (3-Tier Fallback)

The app uses a robust 3-tier fallback system:

1. **LIVE** - Fetch from API (`https://otsukadetailer.site/api/products`)
2. **CACHED** - Use localStorage cached products
3. **BUNDLED** - Use hardcoded demo products in code

### Current Implementation

**File:** `/src/app/lib/products.ts`

```typescript
export async function getProducts(): Promise<{
  products: Product[];
  source: 'live' | 'cached' | 'bundled';
}> {
  try {
    // Try live fetch
    const products = await apiClient.getProducts();
    
    // Cache the result
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({
      products: products.products,
      version: products.version,
      timestamp: new Date().toISOString()
    }));
    
    return {
      products: products.products,
      source: 'live',
    };
  } catch {
    // Try cache
    const cached = getCachedProducts();
    if (cached) {
      return {
        products: cached,
        source: 'cached',
      };
    }
    
    // Fall back to bundled
    return {
      products: BUNDLED_PRODUCTS,
      source: 'bundled',
    };
  }
}
```

### API Client Implementation

**File:** `/src/app/lib/api.ts`

```typescript
async getProducts(): Promise<ProductsResponse> {
  const response = await fetch(`${API_BASE_URL}/products`, {
    method: 'GET',
    headers: this.getHeaders(),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch products');
  }

  return response.json();
}
```

**Headers sent:**
- `Content-Type: application/json`
- `Authorization: Bearer <token>` (if available)
- Credentials: `include` (sends cookies)

---

## 🚨 Common Issues & Diagnostics

### Issue 1: CORS (Cross-Origin Resource Sharing)

**Symptom:** Browser console shows CORS error

**Example Error:**
```
Access to fetch at 'https://otsukadetailer.site/api/products' from origin 'https://yourapp.com' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

**Root Cause:** Server not configured to allow requests from your domain

**Fix:** Backend needs to add CORS headers:
```javascript
// Express.js example
app.use(cors({
  origin: 'https://yourapp.com',
  credentials: true
}));
```

**Workaround:** App will fall back to bundled products

---

### Issue 2: Authentication Token Missing/Invalid

**Symptom:** API returns 401 Unauthorized

**Check localStorage:**
```javascript
// Open browser console
localStorage.getItem('authToken')
```

**Expected values:**
- Bearer token string (e.g., "eyJhbGc...")
- `"session-cookie-only"`
- `"offline-granted"`
- `null` (not logged in)

**Issue:** If token is invalid/expired, API will reject request

**Fix:** Re-login to get fresh token

---

### Issue 3: Network/Server Unreachable

**Symptom:** Network error, timeout, or ERR_CONNECTION_REFUSED

**Check:**
1. Is `https://otsukadetailer.site` accessible?
2. Is `/api/products` endpoint live?
3. Check browser Network tab

**Test manually:**
```bash
# Test if endpoint is reachable
curl https://otsukadetailer.site/api/products

# Test with auth header
curl -H "Authorization: Bearer YOUR_TOKEN" https://otsukadetailer.site/api/products
```

**Expected response:**
```json
{
  "version": 1,
  "products": [
    {
      "_id": "prod-001",
      "name": "Product Name",
      "category": "Category",
      "thumbnail": "https://...",
      "media": [...]
    }
  ]
}
```

---

### Issue 4: API Response Format Mismatch

**Symptom:** Products fetch but don't display correctly

**Check response structure:**
The app expects:
```typescript
interface ProductsResponse {
  version: number;
  products: Product[];
}

interface Product {
  _id: string;
  name: string;
  category: string;
  thumbnail: string;
  media?: MediaGroup[];
}
```

**Fix:** Ensure API returns this exact structure

---

## 🛠️ Debugging Steps

### Step 1: Check Browser Console

Open Chrome DevTools (F12) → Console tab

**Look for:**
- `[Products] Fetching from API...` - Fetch attempt started
- `[Products] Fetched X products (version Y)` - Success
- `[Products] API fetch failed, checking cache...` - API failed
- `[Products] Using cached products` - Fell back to cache
- `[Products] Using bundled products (offline mode)` - Fell back to bundled

### Step 2: Check Network Tab

Chrome DevTools → Network tab → Reload page

**Find request:** `products`

**Check:**
1. **Status Code:**
   - ✅ `200 OK` - Success
   - ❌ `401 Unauthorized` - Auth issue
   - ❌ `403 Forbidden` - Permission issue
   - ❌ `404 Not Found` - Wrong endpoint
   - ❌ `500 Server Error` - Backend issue
   - ❌ `(failed) CORS error` - CORS issue

2. **Request Headers:**
   - Check if `Authorization` header is present
   - Check if token looks valid

3. **Response:**
   - Check if response structure matches expected format

### Step 3: Check localStorage

Console → type:

```javascript
// Check auth token
localStorage.getItem('authToken')

// Check cached products
JSON.parse(localStorage.getItem('productsConfig'))

// Check account profile
JSON.parse(localStorage.getItem('accountProfile'))
```

### Step 4: Check Data Source Banner

The app shows a banner indicating data source:

- **No banner** = Using live API data ✅
- **Amber banner** = "Showing cached content. Sync to refresh." 🟡
- **Blue banner** = "Showing offline content. Connect to sync latest." 🔵

This tells you immediately which tier is active.

---

## 🔧 Force Different Data Sources

### Force Live Fetch

```javascript
// Clear cache and reload
localStorage.removeItem('productsConfig');
location.reload();
```

### Force Bundled Products

```javascript
// Clear cache and disconnect internet
localStorage.removeItem('productsConfig');
// Turn off WiFi/disconnect ethernet
location.reload();
```

### Check Current Source

```javascript
// In presentations screen, check dataSource state
// Look for banner color/message
```

---

## 📋 API Endpoint Requirements

### Endpoint: `GET /api/products`

**URL:** `https://otsukadetailer.site/api/products`

**Method:** GET

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Credentials:** Include (cookies sent)

**Expected Response:**
```json
{
  "version": 1,
  "products": [
    {
      "_id": "prod-001",
      "name": "CardioHealth Treatment Options",
      "category": "Cardiology",
      "thumbnail": "https://images.unsplash.com/photo-1234.jpg?w=400",
      "media": [
        {
          "groupId": "cardio-standard-protocol",
          "title": "Standard Treatment Protocol",
          "items": [
            {
              "id": "slide-1",
              "type": "image",
              "url": "https://images.unsplash.com/photo-5678.jpg?w=1080",
              "thumbnailUrl": "https://images.unsplash.com/photo-5678.jpg?w=200",
              "title": "Introduction"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 🎯 Quick Diagnosis Checklist

Run through this checklist:

- [ ] **Is the API server running?**
  - Test: `curl https://otsukadetailer.site/api/products`

- [ ] **Is CORS configured?**
  - Look for CORS error in console
  - Check `Access-Control-Allow-Origin` header in Network tab

- [ ] **Is user authenticated?**
  - Check: `localStorage.getItem('authToken')`
  - Should not be `null`

- [ ] **Is the auth token valid?**
  - Try re-logging in
  - Check if token is expired (JWT decode if bearer token)

- [ ] **Is the response format correct?**
  - Check Network tab → products → Response
  - Should match ProductsResponse interface

- [ ] **Are there network issues?**
  - Check for red requests in Network tab
  - Check console for fetch errors

- [ ] **Does the fallback work?**
  - Even if API fails, should see bundled products (6 demo products)

---

## 🐛 Known Issues & Solutions

### Issue: "Failed to fetch products" error

**Cause:** API unreachable or CORS blocking

**Solution:** 
1. App automatically falls back to bundled products
2. Blue banner appears: "Showing offline content"
3. 6 demo products should appear
4. User can still browse and use app

**To fix permanently:** Configure backend CORS

---

### Issue: Products show but thumbnails don't load

**Cause:** Thumbnail URLs are broken or CORS blocks images

**Solution:**
1. Check if thumbnail URLs are valid
2. Ensure images allow cross-origin requests
3. Use `crossorigin="anonymous"` on img tags (already implemented)

---

### Issue: Sync button doesn't refresh products

**Cause:** Sync button calls `getProducts()` again

**Check:**
1. Does sync button show spinner? (should animate)
2. Check console for fetch logs
3. Check if banner changes after sync

**Expected behavior:**
- Click sync → spinner appears
- API fetch attempted
- On success: banner disappears (live data)
- On failure: banner stays (cached/bundled)

---

## 💡 Testing Scenarios

### Scenario 1: Fresh User (No Cache)

**Setup:** Clear localStorage
**Expected:** 
1. App tries API
2. If API works → Live products shown, no banner
3. If API fails → Bundled products shown, blue banner

### Scenario 2: Returning User (Has Cache)

**Setup:** Has cached products from previous session
**Expected:**
1. App tries API
2. If API works → Fresh products shown, no banner
3. If API fails → Cached products shown, amber banner

### Scenario 3: Offline User

**Setup:** Disconnect internet
**Expected:**
1. API fetch fails immediately
2. Falls back to cache (if available)
3. Falls back to bundled (if no cache)
4. Blue banner appears

### Scenario 4: API Returns Empty Array

**Setup:** API returns `{ version: 1, products: [] }`
**Expected:**
- Empty state message: "No presentations found"
- Should NOT crash

---

## 🔍 Advanced Debugging

### Enable Verbose Logging

Add to `/src/app/lib/products.ts`:

```typescript
export async function getProducts() {
  console.group('[Products] Fetch Attempt');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Auth token:', localStorage.getItem('authToken')?.substring(0, 20) + '...');
  
  try {
    console.log('Calling apiClient.getProducts()...');
    const products = await apiClient.getProducts();
    console.log('✅ Success! Products:', products);
    console.groupEnd();
    
    // ... rest of code
  } catch (error) {
    console.error('❌ API fetch failed:', error);
    console.groupEnd();
    // ... rest of code
  }
}
```

### Monitor API Calls

```javascript
// Intercept fetch globally
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('🌐 Fetch:', args[0]);
  return originalFetch.apply(this, args)
    .then(response => {
      console.log('✅ Response:', args[0], response.status);
      return response;
    })
    .catch(error => {
      console.error('❌ Fetch error:', args[0], error);
      throw error;
    });
};
```

---

## 📊 Expected Behavior Summary

| Scenario | API State | Cache State | Result | Banner |
|----------|-----------|-------------|--------|--------|
| Fresh install + API works | ✅ | ❌ | Live products | None |
| Fresh install + API fails | ❌ | ❌ | Bundled products | Blue |
| Returning + API works | ✅ | ✅ | Live products | None |
| Returning + API fails | ❌ | ✅ | Cached products | Amber |
| Offline mode | ❌ | ✅ | Cached products | Amber |
| Offline + no cache | ❌ | ❌ | Bundled products | Blue |

---

## 🎬 Next Steps

Based on what you find:

### If API is working but products don't show:
1. Check response format
2. Check for JavaScript errors in console
3. Check if products array is empty

### If API has CORS issues:
1. Configure backend CORS headers
2. Use proxy in development
3. Accept bundled products as fallback

### If API needs authentication:
1. Verify login flow works
2. Check if token is stored after login
3. Re-login to get fresh token

### If you want to test with different data:
1. Edit `BUNDLED_PRODUCTS` in `/src/app/lib/products.ts`
2. Add more demo products
3. Reload app in offline mode

---

## 🆘 Still Not Working?

Provide these details:

1. **Browser Console Screenshot** - Full errors
2. **Network Tab Screenshot** - products request details
3. **localStorage dump:**
   ```javascript
   console.log({
     authToken: localStorage.getItem('authToken'),
     hasCache: !!localStorage.getItem('productsConfig'),
     accountProfile: localStorage.getItem('accountProfile')
   });
   ```
4. **Banner color/message** - What's shown in the app?
5. **Products count** - How many products appear?

---

**Last Updated:** March 11, 2026  
**Related Files:**
- `/src/app/lib/products.ts` - Product fetching logic
- `/src/app/lib/api.ts` - API client
- `/src/app/screens/presentations.tsx` - Gallery screen
