# Google Fit & Health Connect Setup Guide

## IMPORTANT: Understanding Your Architecture

Your app is a **Web Application (PWA)**, which means:

### What Works ✅
- **Firebase Authentication** - Works perfectly in web browsers
- **Firestore Database** - Works perfectly in web browsers
- **Google Fit API** - Works via server-side OAuth (your current approach)

### What Does NOT Work in Web Browsers ❌
- **Health Connect (Android native API)** - Requires native Android app
- **Google Fit native SDK** - Requires native Android app

### How Your App Currently Works

Your app uses a **server-side OAuth flow** to connect to Google Fit:
1. User clicks "Connect Google Fit"
2. Server generates OAuth URL
3. User authorizes in popup window
4. Google redirects back with tokens
5. Tokens are stored in browser's localStorage
6. App uses tokens to fetch data from Google Fit REST API

---

## Step-by-Step Setup for Google Fit

### Step 1: Create Google Cloud OAuth Credentials

**This is REQUIRED for Google Fit to work:**

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - User Type: **External**
   - App name: **MyLifeOS**
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue**
   - Scopes: Skip this step (we'll add them later)
   - Test users: Add your Gmail address
   - Click **Save and Continue**

4. Now create the OAuth client ID:
   - Application type: **Web application**
   - Name: **MyLifeOS Web Client**
   - **Authorized JavaScript origins:**
     - `http://localhost:4567` (for development)
     - `https://your-production-domain.com` (e.g., `https://mylifeos.vercel.app`)
   - **Authorized redirect URIs:**
     - `http://localhost:4567/auth/callback` (for development)
     - `https://your-production-domain.com/auth/callback` (for production)
   
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

---

### Step 2: Configure Your Environment Variables

Create a `.env` file in your project root (or configure in your hosting platform):

```env
GOOGLE_CLIENT_ID=your-client-id-from-step-1.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-from-step-1
APP_URL=http://localhost:4567
```

**For production (e.g., Vercel):**
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Add:
  - `GOOGLE_CLIENT_ID` = your-client-id
  - `GOOGLE_CLIENT_SECRET` = your-client-secret
  - `APP_URL` = https://your-production-domain.com

---

### Step 3: Enable Google Fit API

1. Go to: https://console.cloud.google.com/apis/library
2. Search for **"Google Fit API"**
3. Click on it and press **ENABLE**
4. Wait a few minutes for it to activate

---

### Step 4: Add OAuth Scopes to Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Scroll down to **Test users**
3. Add your Gmail address as a test user (if not already added)
4. Click **Save and Continue**

**Important:** Since your app is not verified by Google, only test users can use it during development.

---

### Step 5: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open: http://localhost:4567

3. Go to Settings → Devices & Integrations

4. Click **Connect** next to Google Fit

5. You should see a popup window for Google authorization

6. After authorizing, you should see:
   - "เชื่อมต่อ Google Fit สำเร็จ!" notification
   - Green "Connected" badge

7. Click **Sync Data Now** to fetch your health data

---

## Troubleshooting Google Fit

### Error: "MISSING_SECRETS"
**Cause:** Environment variables not set  
**Fix:** Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to your `.env` file

### Error: "Popup blocked"
**Cause:** Browser blocking popups  
**Fix:** Allow popups for your domain in browser settings

### Error: "redirect_uri_mismatch"
**Cause:** Redirect URI doesn't match  
**Fix:** Ensure the redirect URI in Google Cloud Console exactly matches:
- Development: `http://localhost:4567/auth/callback`
- Production: `https://your-domain.com/auth/callback`

### Error: "access_denied"
**Cause:** User is not in test users list  
**Fix:** Add your Gmail to test users in OAuth consent screen

### Error: "Token expired"
**Cause:** Access token expired (expires in 1 hour)  
**Fix:** The app should automatically use refresh token to get a new one

---

## Health Connect Setup (For Future Native Android App)

**Health Connect is an Android-only API.** It cannot work in a web browser.

If you want to add Health Connect support in the future, you'll need to:

1. **Convert your app to a native Android app** using:
   - Capacitor (recommended for React apps)
   - React Native
   - Native Android (Kotlin/Java)

2. **Add Health Connect dependency:**
   ```gradle
   dependencies {
       implementation("androidx.health.connect:connect-client:1.1.0-alpha07")
   }
   ```

3. **Add permissions to AndroidManifest.xml:**
   ```xml
   <uses-permission android:name="android.permission.health.READ_STEPS"/>
   <uses-permission android:name="android.permission.health.READ_HEART_RATE"/>
   <uses-permission android:name="android.permission.health.READ_SLEEP"/>
   <uses-permission android:name="android.permission.health.READ_WEIGHT"/>
   ```

4. **Request permissions at runtime:**
   ```kotlin
   val permissionController = HealthPermissionsController(context)
   permissionController.requestPermission(HealthPermission.READ_STEPS)
   ```

**For now, focus on Google Fit - it's the only integration that works with your web app.**

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   User's Browser                    │
│  ┌──────────────────────────────────────────────┐   │
│  │  MyLifeOS PWA (React + Firebase)            │   │
│  │  - Firebase Auth ✅                          │   │
│  │  - Firestore ✅                              │   │
│  │  - Dexie (IndexedDB) ✅                      │   │
│  └──────────────────────────────────────────────┘   │
│                      ↕ OAuth                        │
│  ┌──────────────────────────────────────────────┐   │
│  │  Google Fit REST API (via server proxy)     │   │
│  │  - Steps ✅                                  │   │
│  │  - Sleep ✅                                  │   │
│  │  - Heart Rate ✅                             │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         ↕ Server-side OAuth flow
┌─────────────────────────────────────────────────────┐
│               Your Server (server.ts)               │
│  - Generates OAuth URL ✅                           │
│  - Exchanges code for tokens ✅                     │
│  - Refreshes tokens ✅                              │
└─────────────────────────────────────────────────────┘
         ↕ Google Cloud OAuth
┌─────────────────────────────────────────────────────┐
│            Google Cloud Platform                    │
│  - OAuth 2.0 Authorization ✅                       │
│  - Google Fit API ✅                                │
└─────────────────────────────────────────────────────┘
```

---

## Next Steps

1. ✅ Complete Steps 1-5 above
2. ✅ Test Google Fit connection
3. ✅ Test data sync
4. ✅ Move to Phase 3: Production build configuration
