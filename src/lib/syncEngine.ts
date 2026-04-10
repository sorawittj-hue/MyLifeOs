/**
 * ── SyncEngine: Robust Two-Way Sync (Dexie ↔ Firebase) ──────
 * 
 * Strategy: "Last Write Wins" with conflict detection.
 * 
 * - Each local record has `updatedAt` (timestamp) and `syncStatus` ('pending' | 'synced').
 * - On sync, we compare local vs remote `updatedAt` to determine winner.
 * - Pending local changes are pushed to Firebase.
 * - Remote changes newer than local are pulled down.
 * - Conflicts (simultaneous edits) are resolved by timestamp.
 */

import { db, type SyncableRecord, type SyncStatus } from './db';
import { firebaseService } from './firebaseService';
import type { Table } from 'dexie';

// ── Types ────────────────────────────────────────────────────
interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
}

type SyncableCollectionName = 
  | 'foodLogs' | 'waterLogs' | 'stepLogs' | 'sleepLogs'
  | 'vitals' | 'bodyMetrics' | 'habits' | 'habitCompletions'
  | 'fastingSessions' | 'workouts' | 'chatMessages';

// ── Network Status ───────────────────────────────────────────
let isOnline = navigator.onLine;

window.addEventListener('online', () => {
  isOnline = true;
  console.log('[SyncEngine] Back online — triggering sync');
  // Auto-sync when coming back online
  if (pendingSyncUid) {
    syncAllCollections(pendingSyncUid);
  }
});

window.addEventListener('offline', () => {
  isOnline = false;
  console.log('[SyncEngine] Gone offline — queuing changes');
});

let pendingSyncUid: string | null = null;

// ── Core Sync Logic ──────────────────────────────────────────

/**
 * Sync a single collection between Dexie and Firebase.
 * Uses "Last Write Wins" conflict resolution.
 */
async function syncCollection(
  collectionName: SyncableCollectionName,
  uid: string
): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };

  try {
    const table = db[collectionName] as Table<SyncableRecord & { id?: number; _firebaseId?: string }>;

    // 1. Get all LOCAL records with syncStatus = 'pending'
    const pendingLocal = await table
      .where('syncStatus')
      .equals('pending')
      .toArray();

    // 2. Get ALL remote records for this user
    const remoteRecords = await firebaseService.getCollection<any>(collectionName, uid);

    // Build a map of remote records by _firebaseId for quick lookup
    const remoteMap = new Map<string, any>();
    for (const remote of remoteRecords) {
      remoteMap.set(remote.id, remote);
    }

    // 3. PUSH: Send pending local records to Firebase
    for (const local of pendingLocal) {
      try {
        if (local._firebaseId) {
          // Record exists in Firebase — check for conflict
          const remote = remoteMap.get(local._firebaseId);
          if (remote && remote.updatedAt > local.updatedAt) {
            // Remote is newer — pull remote version
            await table.update(local.id!, {
              ...remote,
              id: local.id,
              _firebaseId: local._firebaseId,
              syncStatus: 'synced' as SyncStatus,
            });
            result.conflicts++;
          } else {
            // Local is newer or same — push to Firebase
            const { id, _firebaseId, syncStatus, ...data } = local as any;
            await firebaseService.updateInCollection(collectionName, local._firebaseId, {
              ...data,
              uid,
              updatedAt: local.updatedAt,
            });
            await table.update(local.id!, { syncStatus: 'synced' as SyncStatus });
            result.pushed++;
          }
        } else {
          // New local record — push to Firebase
          const { id, syncStatus, ...data } = local as any;
          const firebaseId = await firebaseService.addToCollection(collectionName, {
            ...data,
            uid,
            updatedAt: local.updatedAt,
          });
          if (firebaseId) {
            await table.update(local.id!, {
              _firebaseId: firebaseId,
              syncStatus: 'synced' as SyncStatus,
            });
          }
          result.pushed++;
        }
      } catch (err) {
        result.errors.push(`Push error in ${collectionName}: ${err}`);
      }
    }

    // 4. PULL: Get remote records that are newer than local
    const allLocal = await table.toArray();
    const localFirebaseIds = new Set(
      allLocal
        .filter(r => r._firebaseId)
        .map(r => r._firebaseId!)
    );

    for (const remote of remoteRecords) {
      if (!localFirebaseIds.has(remote.id)) {
        // New remote record — pull to local
        try {
          const { id: firebaseDocId, uid: remoteUid, syncedAt, ...data } = remote;
          await table.add({
            ...data,
            _firebaseId: firebaseDocId,
            syncStatus: 'synced' as SyncStatus,
            updatedAt: remote.updatedAt || Date.now(),
          } as any);
          result.pulled++;
        } catch (err) {
          result.errors.push(`Pull error in ${collectionName}: ${err}`);
        }
      }
    }

  } catch (err) {
    result.errors.push(`Collection sync error (${collectionName}): ${err}`);
  }

  return result;
}

/**
 * Sync ALL collections between Dexie and Firebase.
 */
export async function syncAllCollections(uid: string): Promise<SyncResult> {
  if (!isOnline) {
    console.log('[SyncEngine] Offline — skipping sync');
    pendingSyncUid = uid;
    return { pushed: 0, pulled: 0, conflicts: 0, errors: ['Offline'] };
  }

  pendingSyncUid = uid;

  const collections: SyncableCollectionName[] = [
    'foodLogs', 'waterLogs', 'stepLogs', 'sleepLogs',
    'vitals', 'bodyMetrics', 'habits', 'habitCompletions',
    'fastingSessions', 'workouts', 'chatMessages',
  ];

  const totalResult: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: [] };

  for (const col of collections) {
    const result = await syncCollection(col, uid);
    totalResult.pushed += result.pushed;
    totalResult.pulled += result.pulled;
    totalResult.conflicts += result.conflicts;
    totalResult.errors.push(...result.errors);
  }

  if (totalResult.errors.length > 0) {
    console.warn('[SyncEngine] Sync completed with errors:', totalResult.errors);
  } else {
    console.log(`[SyncEngine] Sync complete: ↑${totalResult.pushed} ↓${totalResult.pulled} ⚡${totalResult.conflicts}`);
  }

  return totalResult;
}

/**
 * Get the count of pending (unsynced) records across all collections.
 */
export async function getPendingSyncCount(): Promise<number> {
  const collections = [
    'foodLogs', 'waterLogs', 'stepLogs', 'sleepLogs',
    'vitals', 'bodyMetrics', 'habits', 'habitCompletions',
    'fastingSessions', 'workouts', 'chatMessages',
  ] as const;

  let count = 0;
  for (const col of collections) {
    try {
      const table = db[col] as Table<SyncableRecord>;
      count += await table.where('syncStatus').equals('pending').count();
    } catch {
      // Table might not exist yet
    }
  }
  return count;
}

/**
 * Check if the app is online.
 */
export function getIsOnline(): boolean {
  return isOnline;
}
