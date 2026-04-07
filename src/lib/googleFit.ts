import axios from 'axios';
import { db } from './db';
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
        await db.stepLogs.add({ date, count: steps, source: 'demo' });
      }

      // Mock Vitals
      const hr = Math.floor(Math.random() * 20) + 65;
      const existingHr = await db.vitals.where({ date, type: 'heart_rate' }).first();
      if (!existingHr) {
        await db.vitals.add({ date, time: '08:00', type: 'heart_rate', value1: hr, unit: 'BPM', source: 'demo' });
      }
    }
    return;
  }

  let accessToken = tokens.access_token;

  // Check if token is expired (expiry_date is in ms)
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
    await Promise.all([
      syncSteps(accessToken, sevenDaysAgo, now),
      syncHeartRate(accessToken, sevenDaysAgo, now),
      syncSleep(accessToken, sevenDaysAgo, now),
    ]);
  } catch (error) {
    console.error('Error syncing Google Fit data:', error);
  }
}

async function syncSteps(accessToken: string, startTime: number, endTime: number) {
  const response = await axios.post(
    `${GOOGLE_FIT_BASE_URL}/dataset:aggregate`,
    {
      aggregateBy: [{ dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps' }],
      bucketByTime: { durationMillis: 86400000 }, // 1 day
      startTimeMillis: startTime,
      endTimeMillis: endTime,
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  for (const bucket of response.data.bucket) {
    const date = format(new Date(parseInt(bucket.startTimeMillis)), 'yyyy-MM-dd');
    const count = bucket.dataset[0].point[0]?.value[0]?.intVal || 0;
    
    if (count > 0) {
      const existing = await db.stepLogs.where('date').equals(date).first();
      if (existing) {
        await db.stepLogs.update(existing.id!, { count, source: 'google_fit' });
      } else {
        await db.stepLogs.add({ date, count, source: 'google_fit' });
      }
    }
  }
}

async function syncHeartRate(accessToken: string, startTime: number, endTime: number) {
  const response = await axios.post(
    `${GOOGLE_FIT_BASE_URL}/dataset:aggregate`,
    {
      aggregateBy: [{ dataTypeName: 'com.google.heart_rate.bpm' }],
      bucketByTime: { durationMillis: 3600000 }, // 1 hour
      startTimeMillis: startTime,
      endTimeMillis: endTime,
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  for (const bucket of response.data.bucket) {
    const points = bucket.dataset[0].point;
    if (points.length > 0) {
      const avgHr = points.reduce((acc: number, p: any) => acc + p.value[0].fpVal, 0) / points.length;
      const date = format(new Date(parseInt(bucket.startTimeMillis)), 'yyyy-MM-dd');
      const time = format(new Date(parseInt(bucket.startTimeMillis)), 'HH:mm');
      
      // Only add if not already present for this exact time
      const existing = await db.vitals.where({ date, time, type: 'heart_rate' }).first();
      if (!existing) {
        await db.vitals.add({
          date,
          time,
          type: 'heart_rate',
          value1: Math.round(avgHr),
          unit: 'BPM',
          source: 'google_fit'
        });
      }
    }
  }
}

async function syncSleep(accessToken: string, startTime: number, endTime: number) {
  const response = await axios.get(
    `${GOOGLE_FIT_BASE_URL}/sessions?startTime=${new Date(startTime).toISOString()}&endTime=${new Date(endTime).toISOString()}&activityType=72`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  for (const session of response.data.session) {
    const date = format(new Date(parseInt(session.startTimeMillis)), 'yyyy-MM-dd');
    const bedtime = format(new Date(parseInt(session.startTimeMillis)), 'HH:mm');
    const wakeTime = format(new Date(parseInt(session.endTimeMillis)), 'HH:mm');
    const durationHours = (parseInt(session.endTimeMillis) - parseInt(session.startTimeMillis)) / 3600000;
    
    const existing = await db.sleepLogs.where('date').equals(date).first();
    if (!existing) {
      await db.sleepLogs.add({
        date,
        bedtime,
        wakeTime,
        quality: Math.min(Math.round(durationHours * 10), 100), // Mock quality based on duration
        source: 'google_fit'
      });
    }
  }
}
