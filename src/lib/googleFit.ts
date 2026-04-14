import axios from 'axios';
import { db, withSyncMeta, type StepLog, type Vital, type SleepLog } from './db';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const GOOGLE_FIT_BASE_URL = 'https://www.googleapis.com/fitness/v1/users/me';

export interface GoogleFitTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

export async function fetchGoogleFitData(tokens: GoogleFitTokens, setTokens: (t: any) => void, isDemo: boolean = false) {
  if (isDemo) {
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const date = format(subDays(now, i), 'yyyy-MM-dd');
      const steps = Math.floor(Math.random() * 5000) + 5000;
      const existingStep = await db.stepLogs.where('date').equals(date).first();
      if (existingStep) {
        await db.stepLogs.update(existingStep.id!, { count: steps, source: 'demo' });
      } else {
        await db.stepLogs.add(withSyncMeta({ date, count: steps, source: 'demo' }) as StepLog);
      }

      // Mock Vitals
      const hr = Math.floor(Math.random() * 20) + 65;
      const existingHr = (await db.vitals.where('date').equals(date).toArray()).find(v => v.type === 'heart_rate');
      if (!existingHr) {
        await db.vitals.add(withSyncMeta({ date, time: '08:00', type: 'heart_rate', value1: hr, unit: 'BPM', source: 'demo' }) as Vital);
      }
    }
    return;
  }

  let accessToken = tokens.access_token;

  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 60000) {
    if (tokens.refresh_token) {
      try {
        const response = await axios.post('/api/auth/google/refresh', {
          refresh_token: tokens.refresh_token,
        });
        accessToken = response.data.access_token;
        setTokens({ ...tokens, ...response.data });
      } catch (error) {
        console.error('Failed to refresh Google Fit token:', error);
        return;
      }
    } else {
      console.error('Google Fit token expired and no refresh token available');
      return;
    }
  }

  const now = Date.now();
  const sevenDaysAgo = subDays(startOfDay(new Date()), 7).getTime();

  try {
    const syncTasks = [
      { name: 'Steps', task: syncSteps(accessToken, sevenDaysAgo, now) },
      { name: 'Heart Rate', task: syncHeartRate(accessToken, sevenDaysAgo, now) },
      { name: 'Sleep', task: syncSleep(accessToken, sevenDaysAgo, now) },
      { name: 'Blood Pressure', task: syncBloodPressure(accessToken, sevenDaysAgo, now) },
      { name: 'Oxygen Saturation', task: syncOxygen(accessToken, sevenDaysAgo, now) },
    ];

    console.log('[GoogleFit] Starting sync tasks for', syncTasks.length, 'metrics');
    await Promise.all(syncTasks.map(t => t.task
      .then(() => console.log(`[GoogleFit] Successfully synced ${t.name}`))
      .catch(e => {
        console.error(`[GoogleFit] Error syncing ${t.name}:`, e.response?.data || e.message);
      })
    ));
    console.log('[GoogleFit] All sync tasks completed');
  } catch (error) {
    console.error('[GoogleFit] General sync error:', error);
  }
}

async function syncSteps(accessToken: string, startTime: number, endTime: number) {
  console.log('[GoogleFit] Syncing steps...');
  const response = await axios.post(
    `${GOOGLE_FIT_BASE_URL}/dataset:aggregate`,
    {
      aggregateBy: [{ 
        dataTypeName: 'com.google.step_count.delta',
        dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
      }],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis: startTime,
      endTimeMillis: endTime,
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  for (const bucket of response.data.bucket) {
    const date = format(new Date(parseInt(bucket.startTimeMillis)), 'yyyy-MM-dd');
    let count = 0;
    if (bucket.dataset[0]?.point) {
      for (const point of bucket.dataset[0].point) {
        count += point.value[0]?.intVal || point.value[0]?.fpVal || 0;
      }
    }
    
    if (count > 0) {
      const existing = await db.stepLogs.where('date').equals(date).first();
      if (existing) {
        await db.stepLogs.update(existing.id!, { count, source: 'google_fit' });
      } else {
        await db.stepLogs.add(withSyncMeta({ date, count, source: 'google_fit' }) as StepLog);
      }
    }
  }
}

async function syncHeartRate(accessToken: string, startTime: number, endTime: number) {
  console.log('[GoogleFit] Syncing heart rate...');
  const response = await axios.post(
    `${GOOGLE_FIT_BASE_URL}/dataset:aggregate`,
    {
      aggregateBy: [{ dataTypeName: 'com.google.heart_rate.bpm' }],
      bucketByTime: { durationMillis: 3600000 },
      startTimeMillis: startTime,
      endTimeMillis: endTime,
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const existingVitals = await db.vitals.where('type').equals('heart_rate').toArray();
  const vitalMap = new Set(existingVitals.map(v => `${v.date}-${v.time}`));
  const newRecords: Vital[] = [];

  for (const bucket of response.data.bucket) {
    if (bucket.dataset[0]?.point) {
      for (const point of bucket.dataset[0].point) {
        const value = Math.round(point.value[0].fpVal || 0);
        const timestamp = parseInt(point.startTimeNanos) / 1000000;
        const date = format(new Date(timestamp), 'yyyy-MM-dd');
        const time = format(new Date(timestamp), 'HH:mm');
        const key = `${date}-${time}`;

        if (!vitalMap.has(key)) {
          newRecords.push(withSyncMeta({
            date,
            time,
            type: 'heart_rate',
            value1: value,
            unit: 'BPM',
            source: 'google_fit'
          }) as Vital);
          vitalMap.add(key);
        }
      }
    }
  }
  
  if (newRecords.length > 0) {
    await db.vitals.bulkAdd(newRecords);
  }
}

async function syncSleep(accessToken: string, startTime: number, endTime: number) {
  console.log('[GoogleFit] Syncing sleep sessions...');
  const response = await axios.get(
    `${GOOGLE_FIT_BASE_URL}/sessions?startTime=${new Date(startTime).toISOString()}&endTime=${new Date(endTime).toISOString()}&activityType=72`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.data.session) return;

  for (const session of response.data.session) {
    const date = format(new Date(parseInt(session.startTimeMillis)), 'yyyy-MM-dd');
    const bedtime = format(new Date(parseInt(session.startTimeMillis)), 'HH:mm');
    const wakeTime = format(new Date(parseInt(session.endTimeMillis)), 'HH:mm');
    const durationHours = (parseInt(session.endTimeMillis) - parseInt(session.startTimeMillis)) / 3600000;
    
    const existing = await db.sleepLogs.where('date').equals(date).first();
    if (!existing) {
      await db.sleepLogs.add(withSyncMeta({
        date,
        bedtime,
        wakeTime,
        quality: Math.min(Math.round(durationHours * 10), 100),
        source: 'google_fit'
      }) as SleepLog);
    }
  }
}

async function syncBloodPressure(accessToken: string, startTime: number, endTime: number) {
  console.log('[GoogleFit] Syncing blood pressure...');
  const response = await axios.post(
    `${GOOGLE_FIT_BASE_URL}/dataset:aggregate`,
    {
      aggregateBy: [{ dataTypeName: 'com.google.blood_pressure' }],
      bucketByTime: { durationMillis: 3600000 },
      startTimeMillis: startTime,
      endTimeMillis: endTime,
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const existingVitals = await db.vitals.where('type').equals('blood_pressure').toArray();
  const vitalMap = new Set(existingVitals.map(v => `${v.date}-${v.time}`));
  const newRecords: Vital[] = [];

  for (const bucket of response.data.bucket) {
    if (bucket.dataset[0]?.point) {
      for (const point of bucket.dataset[0].point) {
        const systolic = Math.round(point.value[0].fpVal || 0);
        const diastolic = Math.round(point.value[1].fpVal || 0);
        const timestamp = parseInt(point.startTimeNanos) / 1000000;
        const date = format(new Date(timestamp), 'yyyy-MM-dd');
        const time = format(new Date(timestamp), 'HH:mm');
        const key = `${date}-${time}`;

        if (!vitalMap.has(key)) {
          newRecords.push(withSyncMeta({
            date,
            time,
            type: 'blood_pressure',
            value1: systolic,
            value2: diastolic,
            unit: 'mmHg',
            source: 'google_fit'
          }) as Vital);
          vitalMap.add(key);
        }
      }
    }
  }
  
  if (newRecords.length > 0) {
    await db.vitals.bulkAdd(newRecords);
  }
}

async function syncOxygen(accessToken: string, startTime: number, endTime: number) {
  console.log('[GoogleFit] Syncing oxygen saturation...');
  const response = await axios.post(
    `${GOOGLE_FIT_BASE_URL}/dataset:aggregate`,
    {
      aggregateBy: [{ dataTypeName: 'com.google.oxygen_saturation' }],
      bucketByTime: { durationMillis: 3600000 },
      startTimeMillis: startTime,
      endTimeMillis: endTime,
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const existingVitals = await db.vitals.where('type').equals('oxygen').toArray();
  const vitalMap = new Set(existingVitals.map(v => `${v.date}-${v.time}`));
  const newRecords: Vital[] = [];

  for (const bucket of response.data.bucket) {
    if (bucket.dataset[0]?.point) {
      for (const point of bucket.dataset[0].point) {
        const oxygen = Math.round(point.value[0].fpVal || 0);
        const timestamp = parseInt(point.startTimeNanos) / 1000000;
        const date = format(new Date(timestamp), 'yyyy-MM-dd');
        const time = format(new Date(timestamp), 'HH:mm');
        const key = `${date}-${time}`;

        if (!vitalMap.has(key)) {
          newRecords.push(withSyncMeta({
            date,
            time,
            type: 'oxygen',
            value1: oxygen,
            unit: '%',
            source: 'google_fit'
          }) as Vital);
          vitalMap.add(key);
        }
      }
    }
  }

  if (newRecords.length > 0) {
    await db.vitals.bulkAdd(newRecords);
  }
}
