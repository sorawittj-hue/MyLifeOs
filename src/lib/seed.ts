import { db } from './db';
import { format, subDays } from 'date-fns';

export async function seedDatabase() {
  const habitsCount = await db.habits.count();
  if (habitsCount === 0) {
    await db.habits.bulkAdd([
      { name: 'Drink 2L Water', frequency: 'daily', color: '#3b82f6', icon: 'droplet', createdAt: Date.now() },
      { name: '10k Steps', frequency: 'daily', color: '#22c55e', icon: 'footprints', createdAt: Date.now() },
      { name: 'Take Vitamins', frequency: 'daily', color: '#eab308', icon: 'pill', createdAt: Date.now() },
      { name: 'No Sugar', frequency: 'daily', color: '#ef4444', icon: 'x-circle', createdAt: Date.now() },
    ]);
  }

  const metricsCount = await db.bodyMetrics.count();
  if (metricsCount === 0) {
    const today = new Date();
    await db.bodyMetrics.bulkAdd([
      { date: format(subDays(today, 6), 'yyyy-MM-dd'), weightKg: 84.5 },
      { date: format(subDays(today, 5), 'yyyy-MM-dd'), weightKg: 84.2 },
      { date: format(subDays(today, 4), 'yyyy-MM-dd'), weightKg: 84.0 },
      { date: format(subDays(today, 3), 'yyyy-MM-dd'), weightKg: 84.1 },
      { date: format(subDays(today, 2), 'yyyy-MM-dd'), weightKg: 83.8 },
      { date: format(subDays(today, 1), 'yyyy-MM-dd'), weightKg: 83.9 },
      { date: format(today, 'yyyy-MM-dd'), weightKg: 83.7 },
    ]);
  }

  const sleepCount = await db.sleepLogs.count();
  if (sleepCount === 0) {
    const today = new Date();
    await db.sleepLogs.bulkAdd([
      { date: format(subDays(today, 3), 'yyyy-MM-dd'), bedtime: '23:00', wakeTime: '07:00', quality: 4 },
      { date: format(subDays(today, 2), 'yyyy-MM-dd'), bedtime: '22:30', wakeTime: '06:30', quality: 5 },
      { date: format(subDays(today, 1), 'yyyy-MM-dd'), bedtime: '23:30', wakeTime: '07:30', quality: 3 },
    ]);
  }
}
