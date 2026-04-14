/**
 * useHealthAutoSync
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements "Perceived Real-time" health data synchronization.
 *
 * Strategy:
 *  1. Page Visibility API — fires a sync whenever the tab becomes visible.
 *  2. Silent background poll — fires every POLL_INTERVAL_MS if the page is
 *     currently visible (no battery waste while the user has switched away).
 *  3. Throttle — enforces MIN_SYNC_GAP_MS between any two actual API calls,
 *     guarding against rapid tab-toggle spam and Google Fit rate limits.
 *
 * Integration:
 *  - Call once at the App level when the user is authenticated & connected.
 *  - Internally uses fetchGoogleFitData, which now writes DIRECTLY to Firebase
 *    Firestore so that the Dashboard's onSnapshot listeners update instantly.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../lib/store';

const POLL_INTERVAL_MS  = 5 * 60 * 1000;  // 5 minutes
const MIN_SYNC_GAP_MS   = 1 * 60 * 1000;  // 1 minute minimum between syncs

export function useHealthAutoSync() {
  const {
    isLoaded,
    isGoogleFitConnected,
    demoMode,
    googleFitTokens,
    setGoogleFitTokens,
    firebaseUser,
  } = useAppStore();

  // Track the wall-clock time of the last successful sync to throttle calls
  const lastSyncAtRef  = useRef<number>(0);
  // Guard against concurrent invocations (e.g. visibility + interval overlap)
  const isSyncingRef   = useRef<boolean>(false);

  useEffect(() => {
    // Only engage the sync engine once the app is ready and health is connected
    const shouldSync = isLoaded && (isGoogleFitConnected || demoMode);
    if (!shouldSync) return;

    // ── Core sync executor ────────────────────────────────────────────────
    const runSync = async (reason: string) => {
      const now = Date.now();

      // Throttle: bail if we synced too recently
      if (now - lastSyncAtRef.current < MIN_SYNC_GAP_MS) {
        console.log(`[HealthAutoSync] Skipped (${reason}) — throttled, ${Math.round((MIN_SYNC_GAP_MS - (now - lastSyncAtRef.current)) / 1000)}s remaining`);
        return;
      }

      // Guard: only one sync at a time
      if (isSyncingRef.current) {
        console.log(`[HealthAutoSync] Skipped (${reason}) — already syncing`);
        return;
      }

      isSyncingRef.current = true;
      lastSyncAtRef.current = now;

      try {
        console.log(`[HealthAutoSync] Starting sync (${reason})...`);
        // Lazy-import to avoid adding googleFit to the initial bundle
        const { fetchGoogleFitData } = await import('../lib/googleFit');

        const uid = firebaseUser?.uid ?? null;

        if (demoMode) {
          await fetchGoogleFitData(
            googleFitTokens || ({} as any),
            setGoogleFitTokens,
            /* isDemo */ true,
            uid,
          );
        } else if (googleFitTokens) {
          await fetchGoogleFitData(
            googleFitTokens,
            setGoogleFitTokens,
            /* isDemo */ false,
            uid,
          );
        }

        console.log(`[HealthAutoSync] Sync complete (${reason})`);
      } catch (err) {
        console.error(`[HealthAutoSync] Sync failed (${reason}):`, err);
      } finally {
        isSyncingRef.current = false;
      }
    };

    // ── 1. Immediate sync on hook activation ─────────────────────────────
    runSync('init');

    // ── 2. Page Visibility API — sync whenever tab comes to foreground ────
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runSync('visibilitychange');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── 3. Background poll — only fires when the page is visible ─────────
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        runSync('poll');
      }
    }, POLL_INTERVAL_MS);

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
    };
  }, [isLoaded, isGoogleFitConnected, demoMode, googleFitTokens, setGoogleFitTokens, firebaseUser?.uid]);
}
