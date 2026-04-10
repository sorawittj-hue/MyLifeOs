/**
 * ── Gamification Engine: Streaks, Badges, & Achievements ─────
 * 
 * Tracks daily streaks for: hydration, workouts, fasting, habits, sleep.
 * Awards badges at milestones: 3, 7, 14, 30, 60, 100 day streaks.
 */

import { db, type StreakRecord, type Badge } from './db';
import { format, subDays, differenceInCalendarDays } from 'date-fns';

// ── Badge Definitions ────────────────────────────────────────
export interface BadgeDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  type: StreakRecord['type'];
  requiredStreak: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  color: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Hydration
  { id: 'hydration_3', name: 'นักดื่มน้ำ', emoji: '💧', description: 'ดื่มน้ำครบ 3 วันติด', type: 'hydration', requiredStreak: 3, tier: 'bronze', color: '#60a5fa' },
  { id: 'hydration_7', name: 'น้ำคือชีวิต', emoji: '🌊', description: 'ดื่มน้ำครบ 7 วันติด', type: 'hydration', requiredStreak: 7, tier: 'silver', color: '#3b82f6' },
  { id: 'hydration_14', name: 'จอมพลังน้ำ', emoji: '🏊', description: 'ดื่มน้ำครบ 14 วันติด', type: 'hydration', requiredStreak: 14, tier: 'gold', color: '#2563eb' },
  { id: 'hydration_30', name: 'ราชาแห่งน้ำ', emoji: '👑', description: 'ดื่มน้ำครบ 30 วันติด', type: 'hydration', requiredStreak: 30, tier: 'platinum', color: '#1d4ed8' },
  
  // Workout
  { id: 'workout_3', name: 'เริ่มต้นดี', emoji: '💪', description: 'ออกกำลังกาย 3 วันติด', type: 'workout', requiredStreak: 3, tier: 'bronze', color: '#ef4444' },
  { id: 'workout_7', name: 'สร้างนิสัย', emoji: '🔥', description: 'ออกกำลังกาย 7 วันติด', type: 'workout', requiredStreak: 7, tier: 'silver', color: '#dc2626' },
  { id: 'workout_14', name: 'นักสู้', emoji: '🥊', description: 'ออกกำลังกาย 14 วันติด', type: 'workout', requiredStreak: 14, tier: 'gold', color: '#b91c1c' },
  { id: 'workout_30', name: 'Iron Core', emoji: '🏆', description: 'ออกกำลังกาย 30 วันติด', type: 'workout', requiredStreak: 30, tier: 'platinum', color: '#991b1b' },
  { id: 'workout_100', name: 'ตำนาน', emoji: '⚡', description: 'ออกกำลังกาย 100 วันติด', type: 'workout', requiredStreak: 100, tier: 'diamond', color: '#7f1d1d' },

  // Fasting
  { id: 'fasting_3', name: 'IF Beginner', emoji: '⏱️', description: 'ทำ IF ครบ 3 วันติด', type: 'fasting', requiredStreak: 3, tier: 'bronze', color: '#22d3ee' },
  { id: 'fasting_7', name: 'IF Warrior', emoji: '🧘', description: 'ทำ IF ครบ 7 วันติด', type: 'fasting', requiredStreak: 7, tier: 'silver', color: '#06b6d4' },
  { id: 'fasting_14', name: 'IF Master', emoji: '🎯', description: 'ทำ IF ครบ 14 วันติด', type: 'fasting', requiredStreak: 14, tier: 'gold', color: '#0891b2' },
  { id: 'fasting_30', name: 'IF Legend', emoji: '🔱', description: 'ทำ IF ครบ 30 วันติด', type: 'fasting', requiredStreak: 30, tier: 'platinum', color: '#0e7490' },

  // Sleep
  { id: 'sleep_3', name: 'นอนดี', emoji: '😴', description: 'นอนหลับ 7+ ชม. 3 วันติด', type: 'sleep', requiredStreak: 3, tier: 'bronze', color: '#818cf8' },
  { id: 'sleep_7', name: 'หลับสนิท', emoji: '🌙', description: 'นอนหลับ 7+ ชม. 7 วันติด', type: 'sleep', requiredStreak: 7, tier: 'silver', color: '#6366f1' },
  { id: 'sleep_30', name: 'ราชาแห่งนิทรา', emoji: '⭐', description: 'นอนหลับ 7+ ชม. 30 วันติด', type: 'sleep', requiredStreak: 30, tier: 'gold', color: '#4f46e5' },

  // Habits
  { id: 'habit_7', name: 'สร้างวินัย', emoji: '✅', description: 'ทำ habit ครบ 7 วันติด', type: 'habit', requiredStreak: 7, tier: 'silver', color: '#22c55e' },
  { id: 'habit_30', name: 'ปั้นตัวเอง', emoji: '🌟', description: 'ทำ habit ครบ 30 วันติด', type: 'habit', requiredStreak: 30, tier: 'gold', color: '#16a34a' },
  { id: 'habit_60', name: 'จอมวินัย', emoji: '💎', description: 'ทำ habit ครบ 60 วันติด', type: 'habit', requiredStreak: 60, tier: 'platinum', color: '#15803d' },
];

// ── Tier Colors for UI ───────────────────────────────────────
export const TIER_STYLES: Record<BadgeDefinition['tier'], { bg: string; border: string; glow: string }> = {
  bronze:   { bg: 'bg-amber-900/20', border: 'border-amber-700/40', glow: 'shadow-amber-500/20' },
  silver:   { bg: 'bg-zinc-400/20', border: 'border-zinc-400/40', glow: 'shadow-zinc-400/20' },
  gold:     { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', glow: 'shadow-yellow-500/30' },
  platinum: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', glow: 'shadow-cyan-500/30' },
  diamond:  { bg: 'bg-violet-500/20', border: 'border-violet-500/40', glow: 'shadow-violet-500/30' },
};

// ── Streak Operations ────────────────────────────────────────

/**
 * Update a streak for a given type. 
 * Call this when a user completes a daily goal.
 */
export async function updateStreak(type: StreakRecord['type']): Promise<{
  streak: StreakRecord;
  newBadges: BadgeDefinition[];
}> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  let record = await db.streaks.where('type').equals(type).first();

  if (!record) {
    // First time — create streak
    const id = await db.streaks.add({
      type,
      currentStreak: 1,
      longestStreak: 1,
      lastCompletedDate: today,
      updatedAt: Date.now(),
    });
    record = await db.streaks.get(id);
  } else if (record.lastCompletedDate === today) {
    // Already completed today — no change
    return { streak: record, newBadges: [] };
  } else if (record.lastCompletedDate === yesterday) {
    // Consecutive day — increment streak
    const newStreak = record.currentStreak + 1;
    const newLongest = Math.max(record.longestStreak, newStreak);
    await db.streaks.update(record.id!, {
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastCompletedDate: today,
      updatedAt: Date.now(),
    });
    record = { ...record, currentStreak: newStreak, longestStreak: newLongest, lastCompletedDate: today };
  } else {
    // Streak broken — reset to 1
    await db.streaks.update(record.id!, {
      currentStreak: 1,
      lastCompletedDate: today,
      updatedAt: Date.now(),
    });
    record = { ...record, currentStreak: 1, lastCompletedDate: today };
  }

  // Check for new badges
  const newBadges = await checkAndAwardBadges(type, record!.currentStreak);

  return { streak: record!, newBadges };
}

/**
 * Get all streaks.
 */
export async function getAllStreaks(): Promise<StreakRecord[]> {
  return db.streaks.toArray();
}

/**
 * Get a specific streak by type.
 */
export async function getStreak(type: StreakRecord['type']): Promise<StreakRecord | undefined> {
  return db.streaks.where('type').equals(type).first();
}

// ── Badge Operations ─────────────────────────────────────────

/**
 * Check if any badges should be awarded based on current streak.
 * Returns newly awarded badges.
 */
async function checkAndAwardBadges(
  type: StreakRecord['type'],
  currentStreak: number
): Promise<BadgeDefinition[]> {
  const eligibleBadges = BADGE_DEFINITIONS.filter(
    b => b.type === type && b.requiredStreak <= currentStreak
  );

  const existingBadgeIds = (await db.badges.where('type').equals(type).toArray())
    .map(b => b.badgeId);

  const newBadges: BadgeDefinition[] = [];

  for (const badge of eligibleBadges) {
    if (!existingBadgeIds.includes(badge.id)) {
      await db.badges.add({
        badgeId: badge.id,
        earnedAt: Date.now(),
        type: badge.type,
      });
      newBadges.push(badge);
    }
  }

  return newBadges;
}

/**
 * Get all earned badges.
 */
export async function getEarnedBadges(): Promise<(Badge & { definition: BadgeDefinition })[]> {
  const badges = await db.badges.toArray();
  return badges.map(badge => ({
    ...badge,
    definition: BADGE_DEFINITIONS.find(d => d.id === badge.badgeId)!,
  })).filter(b => b.definition); // Filter out any missing definitions
}

/**
 * Get all badge definitions with earned status.
 */
export async function getAllBadgesWithStatus(): Promise<(BadgeDefinition & { earned: boolean; earnedAt?: number })[]> {
  const earned = await db.badges.toArray();
  const earnedMap = new Map(earned.map(b => [b.badgeId, b.earnedAt]));

  return BADGE_DEFINITIONS.map(def => ({
    ...def,
    earned: earnedMap.has(def.id),
    earnedAt: earnedMap.get(def.id),
  }));
}

/**
 * Calculate total gamification score from all streaks and badges.
 */
export async function getGamificationScore(): Promise<number> {
  const streaks = await getAllStreaks();
  const badges = await db.badges.count();

  const streakPoints = streaks.reduce((sum, s) => sum + (s.currentStreak * 10), 0);
  const badgePoints = badges * 50;
  const longestBonus = streaks.reduce((sum, s) => sum + (s.longestStreak * 5), 0);

  return streakPoints + badgePoints + longestBonus;
}
