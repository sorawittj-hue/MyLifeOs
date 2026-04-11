# Firebase Production Setup Guide

## IMPORTANT: Your App Type

Your app is a **Web Application (PWA)**, NOT a native Android app. This means:
- ✅ **SHA-1/SHA-256 keys are NOT needed** for Firebase
- ✅ Your Firebase config is already correct for web
- ✅ You only need to configure Firebase Authentication and Firestore

---

## Step-by-Step Setup

### 1. Deploy Firestore Security Rules

The updated `firestore.rules` file has been fixed. You need to deploy it:

**Option A: Using Firebase Console (Easiest)**
1. Go to: https://console.firebase.google.com/
2. Select your project: **mylifeos-46f98**
3. Click **Firestore Database** in the left menu
4. Click the **Rules** tab
5. Copy the entire contents of `firestore.rules` and paste it
6. Click **Publish**

**Option B: Using Firebase CLI (Recommended for production)**
```bash
# Install Firebase CLI (one-time only)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firestore rules (if not already done)
firebase init firestore

# Deploy the rules
firebase deploy --only firestore:rules
```

---

### 2. Enable Google Sign-In in Firebase Console

This is **CRITICAL** - without this, authentication will fail:

1. Go to: https://console.firebase.google.com/
2. Select your project: **mylifeos-46f98**
3. Click **Authentication** in the left menu
4. Click the **Sign-in method** tab
5. Find **Google** and click on it
6. Toggle **Enable** to ON
7. Enter a **Project support email** (your Gmail)
8. Click **Save**

---

### 3. Authorize Your Production Domain

Your app needs permission to use Google Sign-In on your production domain:

1. Go to: https://console.firebase.google.com/
2. Select your project: **mylifeos-46f98**
3. Click **Authentication** in the left menu
4. Click the **Settings** tab
5. Scroll down to **Authorized domains**
6. Click **Add domain**
7. Add your production domain (e.g., `mylifeos.vercel.app` if using Vercel)
8. Also add `localhost` for development

**Example domains to add:**
- `localhost` (for development)
- `mylifeos.vercel.app` (for production on Vercel)
- `*.vercel.app` (if using Vercel preview deployments)

---

### 4. Verify Firebase Configuration

Your `firebase-applet-config.json` should already be correct. Verify it contains:

```json
{
  "apiKey": "AIzaSyDgwN0_sIZ19_oZNLoYfE2D2Dyyk2ZJ8YVyw",
  "authDomain": "mylifeos-46f98.firebaseapp.com",
  "projectId": "mylifeos-46f98",
  "storageBucket": "mylifeos-46f98.firebasestorage.app",
  "messagingSenderId": "248943582285",
  "appId": "1:248943582285:web:5a573f654d774909811004"
}
```

✅ This is already configured correctly!

---

### 5. Test Firebase in Production

After completing steps 1-4, test the following:

**Test Authentication:**
1. Open your production URL
2. Click login with Google
3. You should see your profile load
4. Check browser console for logs starting with `[FirebaseService]`

**Test Firestore Writes:**
1. Add a food log or any data
2. Check browser console - you should see:
   ```
   [FirebaseService] Adding to foodLogs
   [FirebaseService] Added document to foodLogs with ID: xxx
   ```

**Test Firestore Reads:**
1. Refresh the page
2. Your data should load from Firebase
3. Check console for:
   ```
   [FirebaseService] Getting collection foodLogs
   [FirebaseService] Retrieved X documents from foodLogs
   ```

---

## Common Errors & Solutions

### Error: "permission-denied"
**Cause:** Firestore rules are blocking access  
**Fix:** Deploy the updated `firestore.rules` (Step 1)

### Error: "configuration-not-found"
**Cause:** Google Sign-In is not enabled  
**Fix:** Enable Google provider in Firebase Console (Step 2)

### Error: "unauthorized-domain"
**Cause:** Your domain is not in authorized domains  
**Fix:** Add your domain to authorized domains (Step 3)

### Error: "network-error"
**Cause:** Internet connection issue or Firebase is blocked  
**Fix:** Check your internet connection and firewall settings

---

## About SHA-1/SHA-256 Keys

**You DO NOT need SHA-1 keys for your app!**

SHA-1 keys are only required for:
- Native Android apps using Firebase
- Android apps using Google Sign-In with native SDK

Your app is a **web app**, so it uses browser-based OAuth which doesn't require SHA-1 keys.

**If you later build a native Android app** (using Capacitor, React Native, or native Android), then you'll need to:

1. Generate a keystore file
2. Get SHA-1 using:
   ```bash
   keytool -list -v -keystore your-keystore.jks -alias your-alias
   ```
3. Add it to Firebase Console > Project Settings > Your apps > Add SHA certificate fingerprints

But for now, **ignore SHA-1** - your web app works without it!

---

## Next Steps

After completing Firebase setup:
1. ✅ Test authentication works
2. ✅ Test data sync works
3. ✅ Move to Phase 2: Google Fit & Health Connect setup
