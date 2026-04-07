export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export function sendNotification(title: string, options?: NotificationOptions) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  return new Notification(title, {
    icon: 'https://picsum.photos/seed/health/192/192',
    ...options
  });
}

export function scheduleNotification(title: string, options: NotificationOptions, delayMs: number) {
  setTimeout(() => {
    sendNotification(title, options);
  }, delayMs);
}

// Notification intervals (in ms)
const WATER_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
const FOOD_INTERVALS = [
  { hour: 7, label: 'มื้อเช้า' },
  { hour: 12, label: 'มื้อกลางวัน' },
  { hour: 18, label: 'มื้อเย็น' },
];

let waterTimerId: number | null = null;
let foodTimerIds: number[] = [];
let sleepTimerId: number | null = null;

export function startWaterReminders() {
  stopWaterReminders();
  // Send first reminder after 2 hours, then every 2 hours
  waterTimerId = window.setInterval(() => {
    sendNotification('💧 เตือนดื่มน้ำ', { 
      body: 'ถึงเวลาดื่มน้ำแล้วครับ! ดื่มน้ำให้เพียงพอเพื่อสุขภาพที่ดี' 
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

    // If target time already passed today, schedule for tomorrow
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();
    const timerId = window.setTimeout(() => {
      sendNotification(`🍽️ เตือนบันทึก${label}`, {
        body: `อย่าลืมบันทึก${label}ของคุณในวันนี้ครับ!`
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
  
  // Remind 30 minutes before bedtime
  target.setHours(bedtimeHour, 0, 0, 0);
  const reminderTime = target.getTime() - 30 * 60 * 1000;

  let delay = reminderTime - now.getTime();
  if (delay < 0) {
    // Schedule for tomorrow
    delay += 24 * 60 * 60 * 1000;
  }

  sleepTimerId = window.setTimeout(() => {
    sendNotification('🌙 เตือนการนอน', {
      body: 'อีก 30 นาทีจะถึงเวลานอนแล้วครับ เริ่มเตรียมตัวได้เลย!'
    });
  }, delay);
}

export function stopSleepReminder() {
  if (sleepTimerId) {
    clearTimeout(sleepTimerId);
    sleepTimerId = null;
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
