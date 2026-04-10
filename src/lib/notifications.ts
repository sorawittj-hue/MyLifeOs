/**
 * ── Notifications: Push + Local + Service Worker ─────────────
 * 
 * Supports:
 * 1. Browser Notification API (existing)
 * 2. Firebase Cloud Messaging (FCM) for real push notifications
 * 3. Service Worker notifications for background alerts
 */

import { getFirebaseMessaging } from './firebase';
import { getToken, onMessage } from 'firebase/messaging';

// ── Permission Request ───────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

// ── Local Notifications ──────────────────────────────────────
export function sendNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  // Try Service Worker notification first (works in background)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      options: {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        vibrate: [100, 50, 100],
        ...options,
      },
    });
    return;
  }

  // Fallback to regular Notification API
  return new Notification(title, {
    icon: '/favicon.svg',
    ...options,
  });
}

export function scheduleNotification(title: string, options: NotificationOptions, delayMs: number) {
  setTimeout(() => {
    sendNotification(title, options);
  }, delayMs);
}

// ── FCM Push Token Registration ──────────────────────────────
let fcmToken: string | null = null;

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      console.log('FCM not supported in this browser');
      return null;
    }

    const permission = await requestNotificationPermission();
    if (!permission) return null;

    // Get the FCM token
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FCM_VAPID_KEY || '',
    });

    if (token) {
      fcmToken = token;
      console.log('[FCM] Push token registered:', token.substring(0, 20) + '...');
      return token;
    }
    return null;
  } catch (error) {
    console.error('[FCM] Failed to register:', error);
    return null;
  }
}

/**
 * Listen for foreground FCM messages
 */
export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  let unsubscribe: (() => void) | null = null;

  (async () => {
    try {
      const messaging = await getFirebaseMessaging();
      if (!messaging) return;
      
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground message:', payload);
        callback(payload);
        
        // Also show as notification
        if (payload.notification) {
          sendNotification(payload.notification.title || 'LifeOS', {
            body: payload.notification.body,
          });
        }
      });
    } catch (error) {
      console.error('[FCM] Listen error:', error);
    }
  })();

  return () => unsubscribe?.();
}

// ── Notification intervals (in ms) ──────────────────────────
const WATER_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
const FOOD_INTERVALS = [
  { hour: 7, label: 'มื้อเช้า' },
  { hour: 12, label: 'มื้อกลางวัน' },
  { hour: 18, label: 'มื้อเย็น' },
];

let waterTimerId: number | null = null;
let foodTimerIds: number[] = [];
let sleepTimerId: number | null = null;
let fastingTimerId: number | null = null;

export function startWaterReminders() {
  stopWaterReminders();
  waterTimerId = window.setInterval(() => {
    sendNotification('💧 เตือนดื่มน้ำ', { 
      body: 'ถึงเวลาดื่มน้ำแล้วครับ! ดื่มน้ำให้เพียงพอเพื่อสุขภาพที่ดี',
      tag: 'water-reminder',
    });
  }, WATER_INTERVAL);
}

export function stopWaterReminders() {
  if (waterTimerId) {
    clearInterval(waterTimerId);
    waterTimerId = null;
  }
}

export function startFoodReminders() {
  stopFoodReminders();
  const now = new Date();
  
  FOOD_INTERVALS.forEach(({ hour, label }) => {
    const target = new Date(now);
    target.setHours(hour, 30, 0, 0);

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();
    const timerId = window.setTimeout(() => {
      sendNotification(`🍽️ เตือนบันทึก${label}`, {
        body: `อย่าลืมบันทึก${label}ของคุณในวันนี้ครับ!`,
        tag: `food-reminder-${label}`,
      });
    }, delay);
    foodTimerIds.push(timerId);
  });
}

export function stopFoodReminders() {
  foodTimerIds.forEach(id => clearTimeout(id));
  foodTimerIds = [];
}

export function startSleepReminder(bedtimeHour: number = 22) {
  stopSleepReminder();
  const now = new Date();
  const target = new Date(now);
  
  target.setHours(bedtimeHour, 0, 0, 0);
  const reminderTime = target.getTime() - 30 * 60 * 1000;

  let delay = reminderTime - now.getTime();
  if (delay < 0) {
    delay += 24 * 60 * 60 * 1000;
  }

  sleepTimerId = window.setTimeout(() => {
    sendNotification('🌙 เตือนการนอน', {
      body: 'อีก 30 นาทีจะถึงเวลานอนแล้วครับ เริ่มเตรียมตัวได้เลย!',
      tag: 'sleep-reminder',
    });
  }, delay);
}

export function stopSleepReminder() {
  if (sleepTimerId) {
    clearTimeout(sleepTimerId);
    sleepTimerId = null;
  }
}

// ── NEW: Fasting Target Reached Notification ─────────────────
export function scheduleFastingCompletionNotification(targetMs: number) {
  stopFastingNotification();
  
  if (targetMs <= 0) return;
  
  fastingTimerId = window.setTimeout(() => {
    sendNotification('🎉 ยินดีด้วย! ทำ IF สำเร็จ', {
      body: 'คุณอดอาหารครบตามเป้าหมายแล้ว! ได้เวลา Break Fast อย่างสุขภาพดี',
      tag: 'fasting-complete',
    });
  }, targetMs);
}

export function stopFastingNotification() {
  if (fastingTimerId) {
    clearTimeout(fastingTimerId);
    fastingTimerId = null;
  }
}

export function syncNotificationSchedule(settings: { water: boolean; food: boolean; sleep: boolean }) {
  if (settings.water) startWaterReminders();
  else stopWaterReminders();

  if (settings.food) startFoodReminders();
  else stopFoodReminders();

  if (settings.sleep) startSleepReminder();
  else stopSleepReminder();
}
