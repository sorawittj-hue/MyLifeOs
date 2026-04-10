import { db, withSyncMeta } from './db';
import { format, subDays } from 'date-fns';

export async function seedDatabase() {
  const habitsCount = await db.habits.count();
  if (habitsCount === 0) {
    await db.habits.bulkAdd([
      withSyncMeta({ name: 'ดื่มน้ำ 2 ลิตร', frequency: 'daily' as const, color: '#3b82f6', icon: 'droplet', createdAt: Date.now() }),
      withSyncMeta({ name: 'เดิน 10,000 ก้าว', frequency: 'daily' as const, color: '#22c55e', icon: 'footprints', createdAt: Date.now() }),
      withSyncMeta({ name: 'ทานวิตามิน', frequency: 'daily' as const, color: '#eab308', icon: 'pill', createdAt: Date.now() }),
      withSyncMeta({ name: 'งดน้ำตาล', frequency: 'daily' as const, color: '#ef4444', icon: 'x-circle', createdAt: Date.now() }),
    ]);
  }

  const metricsCount = await db.bodyMetrics.count();
  if (metricsCount === 0) {
    const today = new Date();
    await db.bodyMetrics.bulkAdd([
      withSyncMeta({ date: format(subDays(today, 6), 'yyyy-MM-dd'), weightKg: 84.5 }),
      withSyncMeta({ date: format(subDays(today, 5), 'yyyy-MM-dd'), weightKg: 84.2 }),
      withSyncMeta({ date: format(subDays(today, 4), 'yyyy-MM-dd'), weightKg: 84.0 }),
      withSyncMeta({ date: format(subDays(today, 3), 'yyyy-MM-dd'), weightKg: 84.1 }),
      withSyncMeta({ date: format(subDays(today, 2), 'yyyy-MM-dd'), weightKg: 83.8 }),
      withSyncMeta({ date: format(subDays(today, 1), 'yyyy-MM-dd'), weightKg: 83.9 }),
      withSyncMeta({ date: format(today, 'yyyy-MM-dd'), weightKg: 83.7 }),
    ]);
  }

  const sleepCount = await db.sleepLogs.count();
  if (sleepCount === 0) {
    const today = new Date();
    await db.sleepLogs.bulkAdd([
      withSyncMeta({ date: format(subDays(today, 3), 'yyyy-MM-dd'), bedtime: '23:00', wakeTime: '07:00', quality: 4 }),
      withSyncMeta({ date: format(subDays(today, 2), 'yyyy-MM-dd'), bedtime: '22:30', wakeTime: '06:30', quality: 5 }),
      withSyncMeta({ date: format(subDays(today, 1), 'yyyy-MM-dd'), bedtime: '23:30', wakeTime: '07:30', quality: 3 }),
    ]);
  }
}
