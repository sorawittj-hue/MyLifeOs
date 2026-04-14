/**
 * googleFit.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches health metrics from the Google Fit REST API and persists them.
 *
 * Dual-write strategy (authenticated users):
 *  - Writes go directly to Firebase Firestore via firebaseService.
 *  - Because Dashboard uses onSnapshot listeners, Firestore writes cause
 *    instantaneous UI updates — no secondary manual sync step required.
 *  - Dexie is used only as a local mirror for guest / offline scenarios.
 *
 * For unauthenticated (guest) users:
 *  - Falls back to Dexie only (original behaviour).
 */

import axios from 'axios';
import { db, withSyncMeta, type StepLog, type Vital, type SleepLog } from './db';
import { format, subDays, startOfDay } from 'date-fns';
import { firebaseService } from './firebaseService';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db as firestoreDb } from './firebase';

const GOOGLE_FIT_BASE_URL = 'https://www.googleapis.com/fitness/v1/users/me';

export interface GoogleFitTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Upsert a step-log document in Firestore for a given date.
 * Uses a deterministic document ID (`uid_date`) so concurrent writes are
 * idempotent — no duplicate records even if the sync fires twice.
 */
async function fsUpsertStep(uid: string, date: string, count: number, source: string) {
  const docId = `${uid}_${date}`;
  const docRef = doc(firestoreDb, 'stepLogs', docId);
  await setDoc(docRef, {
    uid,
    date,
    count,
    source,
    updatedAt: Date.now(),
    syncStatus: 'synced',
    _syncedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Upsert a vital record (heart-rate, blood pressure, oxygen) in Firestore.
 * Document ID = `uid_type_date_time` for natural deduplication.
 */
async function fsUpsertVital(uid: string, vital: Omit<Vital, 'id' | 'syncStatus' | 'updatedAt'>) {
  const docId = `${uid}_${vital.type}_${vital.date}_${vital.time.replace(':', '')}`;
  const docRef = doc(firestoreDb, 'vitals', docId);
  await setDoc(docRef, {
    uid,
    ...vital,
    updatedAt: Date.now(),
    syncStatus: 'synced',
    _syncedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Upsert a sleep-log document in Firestore. One record per date.
 */
async function fsUpsertSleep(uid: string, sleepLog: Omit<SleepLog, 'id' | 'syncStatus' | 'updatedAt'>) {
  const docId = `${uid}_sleep_${sleepLog.date}`;
  const docRef = doc(firestoreDb, 'sleepLogs', docId);
  await setDoc(docRef, {
    uid,
    ...sleepLog,
    updatedAt: Date.now(),
    syncStatus: 'synced',
    _syncedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Main entry point. Fetches all supported Google Fit metrics and persists them.
 *
 * @param tokens        - OAuth tokens (access + optional refresh)
 * @param setTokens     - Callback to persist a refreshed token back to the store
 * @param isDemo        - When true, generates deterministic random demo data
 * @param uid           - Firebase UID; when provided, writes go to Firestore
 *                        (triggering instant Dashboard updates via onSnapshot)
 */
export async function fetchGoogleFitData(
  tokens: GoogleFitTokens,
  setTokens: (t: any) => void,
  isDemo: boolean = false,
  uid: string | null = null,
) {
  if (isDemo) {
    await syncDemoData(uid);
    return;
  }

  // ── Token refresh ─────────────────────────────────────────────────────────
  let accessToken = tokens.access_token;

  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 60_000) {
    if (tokens.refresh_token) {
      try {
        const response = await axios.post('/api/auth/google/refresh', {
          refresh_token: tokens.refresh_token,
        });
        accessToken = response.data.access_token;
        setTokens({ ...tokens, ...response.data });
      } catch (error) {
        console.error('[GoogleFit] Failed to refresh token:', error);
        return;
      }
    } else {
      console.error('[GoogleFit] Token expired and no refresh token available');
      return;
    }
  }

  const now          = Date.now();
  const sevenDaysAgo = subDays(startOfDay(new Date()), 7).getTime();

  const syncTasks = [
    { name: 'Steps',             task: syncSteps(accessToken, sevenDaysAgo, now, uid) },
    { name: 'Heart Rate',        task: syncHeartRate(accessToken, sevenDaysAgo, now, uid) },
    { name: 'Sleep',             task: syncSleep(accessToken, sevenDaysAgo, now, uid) },
    { name: 'Blood Pressure',    task: syncBloodPressure(accessToken, sevenDaysAgo, now, uid) },
    { name: 'Oxygen Saturation', task: syncOxygen(accessToken, sevenDaysAgo, now, uid) },
  ];

  console.log('[GoogleFit] Starting sync for', syncTasks.length, 'metrics', uid ? '→ Firebase' : '→ Dexie');

  await Promise.all(
    syncTasks.map(({ name, task }) =>
      task
        .then(()  => console.log(`[GoogleFit] ✓ ${name}`))
        .catch(e  => console.error(`[GoogleFit] ✗ ${name}:`, e?.response?.data || e?.message)),
    ),
  );

  console.log('[GoogleFit] All sync tasks complete');
}

// ── Demo data ─────────────────────────────────────────────────────────────────

async function syncDemoData(uid: string | null) {
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const date  = format(subDays(now, i), 'yyyy-MM-dd');
    const steps = Math.floor(Math.random() * 5_000) + 5_000;
    const hr    = Math.floor(Math.random() * 20) + 65;

    if (uid) {
      // Firebase path — onSnapshot will push these to the Dashboard instantly
      await fsUpsertStep(uid, date, steps, 'demo');
      await fsUpsertVital(uid, { date, time: '08:00', type: 'heart_rate', value1: hr, unit: 'BPM', source: 'demo' });
    } else {
      // Guest fallback: Dexie only
      const existingStep = await db.stepLogs.where('date').equals(date).first();
      if (existingStep) {
        await db.stepLogs.update(existingStep.id!, { count: steps, source: 'demo' });
      } else {
        await db.stepLogs.add(withSyncMeta({ date, count: steps, source: 'demo' }) as StepLog);
      }

      const existingHr = (await db.vitals.where('date').equals(date).toArray()).find(v => v.type === 'heart_rate');
      if (!existingHr) {
        await db.vitals.add(withSyncMeta({ date, time: '08:00', type: 'heart_rate', value1: hr, unit: 'BPM', source: 'demo' }) as Vital);
      }
    }
  }
}

// ── Sync functions ────────────────────────────────────────────────────────────

async function syncSteps(
  accessToken: string,
  startTime: number,
  endTime: number,
  uid: string | null,
) {
  console.log('[GoogleFit] Syncing steps...');
  const response = await axios.post(
    `${GOOGLE_FIT_BASE_URL}/dataset:aggregate`,
    {
      aggregateBy: [{
        dataTypeName: 'com.google.step_count.delta',
        dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
      }],
      bucketByTime: { durationMillis: 86_400_000 },
      startTimeMillis: startTime,
      endTimeMillis: endTime,
    },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  for (const bucket of response.data.bucket) {
    const date  = format(new Date(parseInt(bucket.startTimeMillis)), 'yyyy-MM-dd');
    let   count = 0;
    if (bucket.dataset[0]?.point) {
      for (const point of bucket.dataset[0].point) {
        count += point.value[0]?.intVal || point.value[0]?.fpVal || 0;
      }
    }

    if (count <= 0) continue;

    if (uid) {
      await fsUpsertStep(uid, date, count, 'google_fit');
    } else {
      const existing = await db.stepLogs.where('date').equals(date).first();
      if (existing) {
        await db.stepLogs.update(existing.id!, { count, source: 'google_fit' });
      } else {
        await db.stepLogs.add(withSyncMeta({ date, count, source: 'google_fit' }) as StepLog);
      }
    }
  }
}

async function syncHeartRate(
  accessToken: string,
  startTime: number,
  endTime: number,
  uid: string | null,
) {
  console.log('[GoogleFit] Syncing heart rate...');
  const response = await axios.post(
    `${GOOGLE_FIT_BASE_URL}/dataset:aggregate`,
    {
      aggregateBy: [{ dataTypeName: 'com.google.heart_rate.bpm' }],
      bucketByTime: { durationMillis: 3_600_000 },
      startTimeMillis: startTime,
      endTimeMillis: endTime,
    },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  // For Dexie dedup: build a set of existing keys upfront
  const existingKeys: Set<string> = uid
    ? new Set() // Firestore uses setDoc/merge — no pre-fetch needed
    : new Set((await db.vitals.where('type').equals('heart_rate').toArray()).map(v => `${v.date}-${v.time}`));

  const dexieRecords: Vital[] = [];

  for (const bucket of response.data.bucket) {
    if (!bucket.dataset[0]?.point) continue;
    for (const point of bucket.dataset[0].point) {
      const value     = Math.round(point.value[0].fpVal || 0);
      const timestamp = parseInt(point.startTimeNanos) / 1_000_000;
      const date      = format(new Date(timestamp), 'yyyy-MM-dd');
      const time      = format(new Date(timestamp), 'HH:mm');
      const key       = `${date}-${time}`;

      if (uid) {
        await fsUpsertVital(uid, { date, time, type: 'heart_rate', value1: value, unit: 'BPM', source: 'google_fit' });
      } else if (!existingKeys.has(key)) {
        dexieRecords.push(withSyncMeta({ date, time, type: 'heart_rate', value1: value, unit: 'BPM', source: 'google_fit' }) as Vital);
        existingKeys.add(key);
      }
    }
  }

  if (!uid && dexieRecords.length > 0) {
    await db.vitals.bulkAdd(dexieRecords);
  }
}

async function syncSleep(
  accessToken: string,
  startTime: number,
  endTime: number,
  uid: string | null,
) {
  console.log('[GoogleFit] Syncing sleep sessions...');
  const response = await axios.get(
    `${GOOGLE_FIT_BASE_URL}/sessions?startTime=${new Date(startTime).toISOString()}&endTime=${new Date(endTime).toISOString()}&activityType=72`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.data.session) return;

  for (const session of response.data.session) {
    const date          = format(new Date(parseInt(session.startTimeMillis)), 'yyyy-MM-dd');
    const bedtime       = format(new Date(parseInt(session.startTimeMillis)), 'HH:mm');
    const wakeTime      = format(new Date(parseInt(session.endTimeMillis)), 'HH:mm');
    const durationHours = (parseInt(session.endTimeMillis) - parseInt(session.startTimeMillis)) / 3_600_000;
    const quality       = Math.min(Math.round(durationHours * 10), 100);

    if (uid) {
      // merge: true means we don't overwrite manually entered data
      await fsUpsertSleep(uid, { date, bedtime, wakeTime, quality, source: 'google_fit' });
    } else {
      const existing = await db.sleepLogs.where('date').equals(date).first();
      if (!existing) {
        await db.sleepLogs.add(withSyncMeta({ date, bedtime, wakeTime, quality, source: 'google_fit' }) as SleepLog);
      }
    }
  }
}

async function syncBloodPressure(
  accessToken: string,
  startTime: number,
  endTime: number,
  uid: string | null,
) {
  console.log('[GoogleFit] Syncing blood pressure...');
  const response = await axios.post(
    `${GOOGLE_FIT_BASE_URL}/dataset:aggregate`,
    {
      aggregateBy: [{ dataTypeName: 'com.google.blood_pressure' }],
      bucketByTime: { durationMillis: 3_600_000 },
      startTimeMillis: startTime,
      endTimeMillis: endTime,
    },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const existingKeys: Set<string> = uid
    ? new Set()
    : new Set((await db.vitals.where('type').equals('blood_pressure').toArray()).map(v => `${v.date}-${v.time}`));

  const dexieRecords: Vital[] = [];

  for (const bucket of response.data.bucket) {
    if (!bucket.dataset[0]?.point) continue;
    for (const point of bucket.dataset[0].point) {
      const systolic  = Math.round(point.value[0].fpVal || 0);
      const diastolic = Math.round(point.value[1].fpVal || 0);
      const timestamp = parseInt(point.startTimeNanos) / 1_000_000;
      const date      = format(new Date(timestamp), 'yyyy-MM-dd');
      const time      = format(new Date(timestamp), 'HH:mm');
      const key       = `${date}-${time}`;

      if (uid) {
        await fsUpsertVital(uid, { date, time, type: 'blood_pressure', value1: systolic, value2: diastolic, unit: 'mmHg', source: 'google_fit' });
      } else if (!existingKeys.has(key)) {
        dexieRecords.push(withSyncMeta({ date, time, type: 'blood_pressure', value1: systolic, value2: diastolic, unit: 'mmHg', source: 'google_fit' }) as Vital);
        existingKeys.add(key);
      }
    }
  }

  if (!uid && dexieRecords.length > 0) {
    await db.vitals.bulkAdd(dexieRecords);
  }
}

async function syncOxygen(
  accessToken: string,
  startTime: number,
  endTime: number,
  uid: string | null,
) {
  console.log('[GoogleFit] Syncing oxygen saturation...');
  const response = await axios.post(
    `${GOOGLE_FIT_BASE_URL}/dataset:aggregate`,
    {
      aggregateBy: [{ dataTypeName: 'com.google.oxygen_saturation' }],
      bucketByTime: { durationMillis: 3_600_000 },
      startTimeMillis: startTime,
      endTimeMillis: endTime,
    },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const existingKeys: Set<string> = uid
    ? new Set()
    : new Set((await db.vitals.where('type').equals('oxygen').toArray()).map(v => `${v.date}-${v.time}`));

  const dexieRecords: Vital[] = [];

  for (const bucket of response.data.bucket) {
    if (!bucket.dataset[0]?.point) continue;
    for (const point of bucket.dataset[0].point) {
      const oxygen    = Math.round(point.value[0].fpVal || 0);
      const timestamp = parseInt(point.startTimeNanos) / 1_000_000;
      const date      = format(new Date(timestamp), 'yyyy-MM-dd');
      const time      = format(new Date(timestamp), 'HH:mm');
      const key       = `${date}-${time}`;

      if (uid) {
        await fsUpsertVital(uid, { date, time, type: 'oxygen', value1: oxygen, unit: '%', source: 'google_fit' });
      } else if (!existingKeys.has(key)) {
        dexieRecords.push(withSyncMeta({ date, time, type: 'oxygen', value1: oxygen, unit: '%', source: 'google_fit' }) as Vital);
        existingKeys.add(key);
      }
    }
  }

  if (!uid && dexieRecords.length > 0) {
    await db.vitals.bulkAdd(dexieRecords);
  }
}
