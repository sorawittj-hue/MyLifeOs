# Production Debugging Guide

## How to Debug Your App in Production

This guide will help you identify and fix issues when your app is running in production.

---

## Step 1: Open Browser Developer Tools

### In Chrome/Edge:
1. Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
2. Click on the **Console** tab
3. Refresh the page

### In Safari:
1. Enable Developer menu: Safari → Settings → Advanced → Show Develop menu
2. Press `Cmd+Option+I`
3. Click on the **Console** tab

---

## Step 2: Check for Errors

Look for **RED** error messages in the console. Common errors include:

### Firebase Authentication Errors

```
❌ [FIRESTORE ERROR] get on users/xxx: Missing or insufficient permissions
❌ FirebaseError: Failed to get document because the client is offline
❌ auth/configuration-not-found
```

**What it means:** Firebase rules are blocking access or Google Sign-In is not enabled

**How to fix:**
1. Deploy the updated `firestore.rules` to Firebase Console
2. Enable Google Sign-In in Firebase Console → Authentication → Sign-in method
3. Add your domain to authorized domains

---

### Firestore Permission Errors

```
❌ [FIRESTORE ERROR] write on foodLogs: Missing or insufficient permissions
❌ FirebaseError: The caller does not have permission
```

**What it means:** The Firestore security rules are too strict

**How to fix:**
1. The updated `firestore.rules` file has already been fixed
2. Deploy it to Firebase Console → Firestore Database → Rules → Publish

---

### Network Errors

```
❌ Failed to fetch
❌ Network Error
❌ ERR_INTERNET_DISCONNECTED
```

**What it means:** Internet connection issue or server is down

**How to fix:**
1. Check your internet connection
2. Verify your server is running (for development)
3. For production, check your hosting platform status

---

### Google Fit OAuth Errors

```
❌ redirect_uri_mismatch
❌ access_denied
❌ MISSING_SECRETS
```

**What it means:** Google OAuth is not configured correctly

**How to fix:**
1. Follow the `GOOGLE_FIT_SETUP_GUIDE.md`
2. Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
3. Verify redirect URI matches exactly in Google Cloud Console

---

## Step 3: Enable Debug Logging

Your app already has debug logging enabled. Look for these log prefixes:

### Firebase Logs
```
[FirebaseService] Getting user profile: users/xxx
[FirebaseService] User profile found
[FirebaseService] Adding to foodLogs
[FirebaseService] Added document to foodLogs with ID: xxx
```

### Sync Engine Logs
```
[SyncEngine] Starting sync for foodLogs (user: xxx)
[SyncEngine] foodLogs: 0 pending local records
[SyncEngine] foodLogs: 5 remote records
[SyncEngine] foodLogs sync complete: ↑0 ↓5 ⚡0
```

### Store Logs
```
[Store] Loading user data...
[Store] Auth state changed: xxx
[Store] Starting data sync to Firebase...
[Store] Syncing foodLogs...
[Store] foodLogs: 3 local records to check
```

### Google Fit Logs
```
[Settings] Initiating Google Fit OAuth flow
[Settings] Opening Google Fit auth window
[Settings] Google Fit auth success, storing tokens
```

---

## Step 4: Test Each Feature

### Test 1: Firebase Authentication

1. Open browser console
2. Click "Login with Google"
3. Look for:
   ```
   [Store] Initiating Google login...
   [Store] Login successful
   [Store] Auth state changed: xxx
   ```
4. If you see errors, check:
   - Google Sign-In is enabled in Firebase Console
   - Your domain is authorized
   - Popups are not blocked

---

### Test 2: Firestore Read/Write

1. After logging in, add a food log
2. Look for:
   ```
   [FirebaseService] Adding to foodLogs
   [FirebaseService] Added document to foodLogs with ID: xxx
   ```
3. Refresh the page
4. Look for:
   ```
   [FirebaseService] Getting collection foodLogs
   [FirebaseService] Retrieved 1 documents from foodLogs
   ```
5. If you see errors, check:
   - Firestore rules are deployed
   - User is authenticated
   - Document has `uid` field matching the authenticated user

---

### Test 3: Data Sync

1. Add some data while offline
2. Go back online
3. Look for:
   ```
   [Store] Back online - triggering sync
   [SyncEngine] Starting sync for foodLogs (user: xxx)
   [SyncEngine] foodLogs: 2 pending local records
   [SyncEngine] foodLogs sync complete: ↑2 ↓0 ⚡0
   ```
4. If you see errors, check:
   - User is authenticated
   - Firestore rules allow writes
   - Data has correct `uid` field

---

### Test 4: Google Fit Integration

1. Go to Settings → Devices & Integrations
2. Click "Connect" next to Google Fit
3. Look for:
   ```
   [Settings] Initiating Google Fit OAuth flow
   [Settings] Opening Google Fit auth window
   [Settings] Google Fit auth success, storing tokens
   ```
4. Click "Sync Data Now"
5. Look for:
   ```
   [GoogleFitProvider] Available: true
   ```
6. If you see errors, check:
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
   - Google Fit API is enabled
   - Redirect URI matches exactly

---

## Step 5: Check Network Tab

### In Chrome/Edge DevTools:
1. Click on the **Network** tab
2. Refresh the page
3. Look for failed requests (red status)

### What to Check:

#### Firebase Requests
- You should see requests to `firestore.googleapis.com`
- Status should be `200` (OK)
- If you see `403` (Forbidden), check Firestore rules
- If you see `401` (Unauthorized), check authentication

#### OAuth Requests
- You should see requests to `accounts.google.com`
- Status should be `200` (OK)
- If you see errors, check OAuth configuration

---

## Step 6: Check Application Tab

### In Chrome/Edge DevTools:
1. Click on the **Application** tab
2. Check these sections:

#### Local Storage
- Click on **Local Storage** → Your domain
- Look for `lifeos-storage` key
- This contains your app's cached data

#### IndexedDB
- Click on **IndexedDB** → `LifeOSDatabase`
- You should see tables like `foodLogs`, `waterLogs`, etc.
- If tables are empty, data hasn't been saved locally

#### Service Workers
- Click on **Service Workers**
- You should see `sw.js` registered and activated
- If not registered, PWA is not working

#### Cache Storage
- Click on **Cache Storage**
- You should see cached assets
- If empty, offline mode won't work

---

## Common Production Issues & Solutions

### Issue: App works in development but not in production

**Symptoms:**
- Works on `localhost:4567`
- Fails on production URL

**Solutions:**
1. Check environment variables are set in production
2. Add production domain to Firebase authorized domains
3. Add production URL to Google Cloud Console OAuth redirect URIs
4. Check CORS headers are set correctly

---

### Issue: Data doesn't sync to Firebase

**Symptoms:**
- Data saves locally but not online
- Console shows "permission-denied" errors

**Solutions:**
1. Check user is logged in (look for `[Store] Auth state changed`)
2. Check Firestore rules are deployed
3. Look for errors in console starting with `[FIRESTORE ERROR]`
4. Verify document has `uid` field matching authenticated user

---

### Issue: Google Fit doesn't connect

**Symptoms:**
- "Connect" button doesn't work
- Popup shows error

**Solutions:**
1. Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
2. Verify redirect URI in Google Cloud Console matches your URL exactly
3. Check Google Fit API is enabled
4. Look for errors in console starting with `[Settings]`

---

### Issue: App is slow in production

**Symptoms:**
- Takes long time to load
- Sync is slow

**Solutions:**
1. Check network speed (run speed test)
2. Look for large bundle sizes in Network tab
3. Enable gzip/brotli compression on server
4. Use CDN for static assets

---

## How to Get Help

If you're still stuck, provide this information:

1. **Console logs** - Copy all logs from browser console (especially errors)
2. **Network logs** - Screenshot of Network tab showing failed requests
3. **Environment** - Development or Production? What URL?
4. **Steps to reproduce** - What were you doing when the error occurred?

---

## Quick Checklist

Before reporting an issue, check:

- [ ] Internet connection is working
- [ ] User is logged in
- [ ] Firestore rules are deployed
- [ ] Google Sign-In is enabled in Firebase Console
- [ ] Production domain is authorized in Firebase Console
- [ ] Environment variables are set (for production)
- [ ] Browser console shows no RED errors
- [ ] Network requests have status 200

---

## Next Steps

After fixing issues:
1. Test all features work correctly
2. Clear browser cache and test again
3. Test on different browsers
4. Test on mobile devices
5. Move to deployment checklist
