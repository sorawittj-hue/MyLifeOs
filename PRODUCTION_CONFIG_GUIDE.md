# Production Build Configuration Guide

## IMPORTANT: Your App Type

Your app is a **Web Application (PWA)**, NOT a native Android app. This means:

### ❌ What You DON'T Need
- **ProGuard/R8 rules** - Only for native Android apps
- **AndroidManifest.xml** - Only for native Android apps
- **SHA-1/SHA-256 keys** - Only for native Android apps with Firebase
- **Keystore files** - Only for publishing to Google Play Store

### ✅ What You DO Need
- **Vite production build optimization** - Already configured!
- **Proper environment variables** - Critical for production
- **Security headers** - Already added to vite.config.ts
- **PWA configuration** - Already configured!

---

## Phase 3 Complete: What Was Done

### 1. Vite Build Optimization ✅

Your `vite.config.ts` has been updated with:

- **Code Splitting**: Large libraries are split into separate chunks for better caching
- **Optimized Chunk Names**: Better organization of built assets
- **Firebase Chunking**: Firebase is split into core and messaging chunks
- **Better Caching**: Vendor chunks are cached separately by browsers

### 2. Build Verification ✅

Run this command to build your app:

```bash
npm run build
```

You should see output like:
```
✓ 3136 modules transformed.
dist/assets/index-CvPU4irS.css                      121.71 kB
dist/assets/firebase-core-[hash].js                 [optimized]
dist/assets/ui-framework-[hash].js                  [optimized]
...
✓ built in [time]
```

---

## Environment Variables for Production

### Required Variables

Create a `.env.production` file (or configure in your hosting platform):

```env
# Firebase Configuration (already in firebase-applet-config.json)
# No additional Firebase env vars needed

# Google Fit OAuth - REQUIRED for health integrations
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# App URL - Your production domain
APP_URL=https://your-domain.com

# Gemini AI API Key (if using AI Coach feature)
GEMINI_API_KEY=your-gemini-api-key
```

### For Vercel Deployment

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add these variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `APP_URL` (set to your Vercel URL)
   - `GEMINI_API_KEY` (if using AI features)

### For Local Development

Create a `.env` file in your project root:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
APP_URL=http://localhost:4567
GEMINI_API_KEY=your-gemini-api-key
```

---

## Security Headers

Your `vite.config.ts` already includes security headers for OAuth popups:

```typescript
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  },
}
```

**For production deployment**, you need to add these headers to your server:

### Vercel (vercel.json)

Your `vercel.json` should include headers:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin-allow-popups"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Nginx (if self-hosting)

```nginx
add_header Cross-Origin-Opener-Policy "same-origin-allow-popups";
add_header X-Content-Type-Options "nosniff";
add_header X-Frame-Options "DENY";
```

---

## PWA Configuration

Your PWA is already configured in `vite.config.ts`:

### What This Means
- ✅ Your app can be installed on mobile devices
- ✅ Works offline (cached assets)
- ✅ Push notifications supported
- ✅ App icon and theme configured

### Testing PWA

1. Build your app:
   ```bash
   npm run build
   ```

2. Preview the production build:
   ```bash
   npm run preview
   ```

3. Open browser DevTools → Application → Service Workers
   - You should see `sw.js` registered

4. Test installability:
   - Chrome: Click the install icon in address bar
   - Mobile: "Add to Home Screen" option

---

## Production Checklist

Before deploying to production:

### Firebase Setup ✅
- [ ] Firestore rules deployed (`firestore.rules`)
- [ ] Google Sign-In enabled in Firebase Console
- [ ] Production domain added to authorized domains
- [ ] Firebase config verified in `firebase-applet-config.json`

### Google Cloud Setup ✅
- [ ] OAuth Client ID created (Web application type)
- [ ] OAuth consent screen configured
- [ ] Google Fit API enabled
- [ ] Test users added (during development)
- [ ] Redirect URIs configured

### Environment Variables ✅
- [ ] `GOOGLE_CLIENT_ID` set
- [ ] `GOOGLE_CLIENT_SECRET` set
- [ ] `APP_URL` set to production URL
- [ ] `GEMINI_API_KEY` set (if using AI features)

### Build Verification ✅
- [ ] `npm run build` completes without errors
- [ ] No console errors in browser
- [ ] Firebase authentication works
- [ ] Firestore reads/writes work
- [ ] Google Fit OAuth flow works

### Security ✅
- [ ] Security headers configured (CORS, COOP, etc.)
- [ ] No sensitive data in client-side code
- [ ] Environment variables not committed to git
- [ ] `.env` in `.gitignore`

---

## Testing Production Build Locally

```bash
# Build for production
npm run build

# Preview the production build locally
npm run preview
```

This will start a server at `http://localhost:4173` with the production build.

---

## Deploying to Vercel

```bash
# Install Vercel CLI (one-time)
npm install -g vercel

# Deploy
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deployments.

---

## Monitoring Production

After deployment, monitor these in browser console:

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

### Google Fit Logs
```
[Settings] Initiating Google Fit OAuth flow
[Settings] Opening Google Fit auth window
[Settings] Google Fit auth success, storing tokens
```

---

## Troubleshooting Production Issues

### Issue: Build fails
**Solution:** Run `npm run lint` to check for TypeScript errors

### Issue: Firebase not working in production
**Solution:** 
1. Check browser console for errors
2. Verify domain is in Firebase authorized domains
3. Check Firestore rules are deployed

### Issue: Google Fit not connecting
**Solution:**
1. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
2. Check redirect URI matches exactly
3. Verify Google Fit API is enabled

### Issue: App works in dev but not in production
**Solution:**
1. Check environment variables are set
2. Check CORS/security headers
3. Look for `process.env` references that might be undefined

---

## Next Steps

1. ✅ Complete the Production Checklist above
2. ✅ Deploy to production
3. ✅ Test all features in production
4. ✅ Move to Phase 4: State management improvements
