/**
 * useHealthAutoSync — Whoop-Killer Real-Time Health Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Ultra-aggressive perceived real-time sync:
 *
 * Strategy:
 *  1. INSTANT sync on hook activation (app load / login)
 *  2. Page Visibility API — sync on every tab-foreground event
 *  3. Online resume — sync immediately when connectivity is restored
 *  4. Aggressive background poll — 60s when visible, paused when hidden
 *  5. Window focus — instant sync on window.focus (when user switches apps)
 *  6. Samsung-optimized: fetches intra-day HR data at 15-min granularity
 *  7. Live sync status event emitter for Dashboard UI indicators
 *
 * Integration:
 *  - Call once at the App level when user is authenticated & connected.
 *  - Writes DIRECTLY to Firestore → Dashboard onSnapshot fires instantly.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../lib/store';

// ── Tuning Constants ─────────────────────────────────────────
const ACTIVE_POLL_MS    = 60 * 1000;    // 60 seconds when tab is visible
const BG_POLL_MS        = 5 * 60 * 1000; // 5 minutes when in background
const MIN_SYNC_GAP_MS   = 30 * 1000;    // 30-second throttle (aggressive)
const RETRY_DELAY_MS    = 10 * 1000;    // Retry after 10s on failure
const MAX_RETRIES       = 3;

// ── Live Sync Status (global event bus for Dashboard) ─────────
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export interface SyncEvent {
  status: SyncStatus;
  lastSyncAt: number;
  error?: string;
  metrics?: { steps?: number; heartRate?: number; sleep?: number };
}

type SyncListener = (event: SyncEvent) => void;
const syncListeners = new Set<SyncListener>();

export function onSyncStatusChange(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function emitSyncStatus(event: SyncEvent) {
  syncListeners.forEach(fn => fn(event));
}

// ── Main Hook ────────────────────────────────────────────────
export function useHealthAutoSync() {
  const {
    isLoaded,
    isGoogleFitConnected,
    demoMode,
    googleFitTokens,
    setGoogleFitTokens,
    firebaseUser,
  } = useAppStore();

  const lastSyncAtRef   = useRef<number>(0);
  const isSyncingRef    = useRef<boolean>(false);
  const retryCountRef   = useRef<number>(0);
  const pollTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Core sync executor ──────────────────────────────────────
  const runSync = useCallback(async (reason: string, force = false) => {
    const now = Date.now();

    // Throttle: bail if we synced too recently (unless forced)
    if (!force && now - lastSyncAtRef.current < MIN_SYNC_GAP_MS) {
      return;
    }

    // Guard: only one sync at a time
    if (isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;
    lastSyncAtRef.current = now;
    emitSyncStatus({ status: 'syncing', lastSyncAt: now });

    try {
      console.log(`[HealthAutoSync] ⚡ Sync (${reason})...`);
      const { fetchGoogleFitData } = await import('../lib/googleFit');
      const uid = firebaseUser?.uid ?? null;

      if (demoMode) {
        await fetchGoogleFitData(
          googleFitTokens || ({} as any),
          setGoogleFitTokens,
          true,
          uid,
        );
      } else if (googleFitTokens) {
        await fetchGoogleFitData(
          googleFitTokens,
          setGoogleFitTokens,
          false,
          uid,
        );
      }

      const syncTime = Date.now();
      retryCountRef.current = 0;
      emitSyncStatus({ status: 'success', lastSyncAt: syncTime });
      console.log(`[HealthAutoSync] ✓ Sync complete (${reason}) — ${Date.now() - now}ms`);
    } catch (err: any) {
      console.error(`[HealthAutoSync] ✗ Sync failed (${reason}):`, err);
      emitSyncStatus({ status: 'error', lastSyncAt: now, error: err?.message });

      if (err?.message === 'TOKEN_EXPIRED_NO_REFRESH' || err?.message === 'TOKEN_REFRESH_FAILED' || err?.response?.status === 401) {
        alert('Google Fit Session Expired: กรุณาเชื่อมต่อ Google Fit ใหม่อีกครั้งในการตั้งค่า');
        // Optional: clear tokens
        // setGoogleFitTokens(null); 
        return; // Don't retry if auth is broken
      }

      // Auto-retry with exponential backoff
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        const delay = RETRY_DELAY_MS * retryCountRef.current;
        console.log(`[HealthAutoSync] Retrying in ${delay / 1000}s (attempt ${retryCountRef.current}/${MAX_RETRIES})`);
        setTimeout(() => runSync(`retry-${retryCountRef.current}`, true), delay);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [firebaseUser?.uid, demoMode, googleFitTokens, setGoogleFitTokens]);

  useEffect(() => {
    const shouldSync = isLoaded && (isGoogleFitConnected || demoMode);
    if (!shouldSync) return;

    // ── 1. Instant sync on activation ────────────────────────
    runSync('init', true);

    // ── 2. Page Visibility API ───────────────────────────────
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runSync('tab-foreground');
        // Switch to aggressive polling when visible
        resetPollInterval(ACTIVE_POLL_MS);
      } else {
        // Stop fetching when hidden to save API quota and battery
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // ── 3. Window focus (separate from visibility — covers app switcher) ─
    const handleFocus = () => runSync('window-focus');
    window.addEventListener('focus', handleFocus);

    // ── 4. Online resume — instant sync when connectivity is restored ────
    const handleOnline = () => {
      console.log('[HealthAutoSync] 🌐 Online — triggering sync');
      runSync('online-resume', true);
    };
    window.addEventListener('online', handleOnline);

    // ── 5. Aggressive background poll ────────────────────────
    function resetPollInterval(ms: number) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        runSync('poll');
      }, ms);
    }
    resetPollInterval(ACTIVE_POLL_MS);

    // ── Cleanup ──────────────────────────────────────────────
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isLoaded, isGoogleFitConnected, demoMode, runSync]);
}
