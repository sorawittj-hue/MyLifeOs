/**
 * ── StreakBadges: Visual streak display & badge showcase ──────
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Flame, Droplets, Timer, Moon, CheckSquare, ChevronRight, Star } from 'lucide-react';
import { 
  type StreakRecord, type Badge as BadgeRecord 
} from '../lib/db';
import {
  getAllStreaks,
  getEarnedBadges,
  getAllBadgesWithStatus,
  getGamificationScore,
  type BadgeDefinition,
  TIER_STYLES,
} from '../lib/gamification';

// ── Streak Type Icons ────────────────────────────────────────
const STREAK_ICONS: Record<StreakRecord['type'], React.ReactNode> = {
  hydration: <Droplets size={18} />,
  workout: <Flame size={18} />,
  fasting: <Timer size={18} />,
  sleep: <Moon size={18} />,
  habit: <CheckSquare size={18} />,
};

const STREAK_COLORS: Record<StreakRecord['type'], { text: string; bg: string }> = {
  hydration: { text: 'text-blue-400', bg: 'bg-blue-500/10' },
  workout: { text: 'text-red-400', bg: 'bg-red-500/10' },
  fasting: { text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  sleep: { text: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  habit: { text: 'text-green-400', bg: 'bg-green-500/10' },
};

const STREAK_LABELS: Record<StreakRecord['type'], string> = {
  hydration: 'ดื่มน้ำ',
  workout: 'ออกกำลังกาย',
  fasting: 'ทำ IF',
  sleep: 'นอนหลับ',
  habit: 'นิสัยดี',
};

// ── StreakCard Component ──────────────────────────────────────
function StreakCard({ streak, isDark }: { streak: StreakRecord; isDark: boolean }) {
  const colors = STREAK_COLORS[streak.type];
  const cardBg = isDark ? 'glass-card' : 'glass-card-light';
  
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`${cardBg} bento-card p-4 space-y-2`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-xl ${colors.bg} ${colors.text} flex items-center justify-center`}>
          {STREAK_ICONS[streak.type]}
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {STREAK_LABELS[streak.type]}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{streak.currentStreak}</span>
        <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>วัน</span>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-[9px] font-medium ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
          สูงสุด: {streak.longestStreak} วัน
        </span>
        {streak.currentStreak >= 7 && (
          <span className="text-[9px] font-bold text-orange-400">🔥</span>
        )}
      </div>
      {/* Mini streak indicator dots */}
      <div className="flex gap-0.5">
        {[...Array(Math.min(streak.currentStreak, 7))].map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full ${colors.bg} ${colors.text} bg-current`} />
        ))}
        {streak.currentStreak > 7 && (
          <span className={`text-[8px] font-bold ${colors.text}`}>+{streak.currentStreak - 7}</span>
        )}
      </div>
    </motion.div>
  );
}

// ── BadgeCard Component ──────────────────────────────────────
function BadgeCard({ badge, earned, isDark }: { badge: BadgeDefinition & { earned: boolean; earnedAt?: number }; earned: boolean; isDark: boolean }) {
  const tierStyle = TIER_STYLES[badge.tier];
  
  return (
    <motion.div
      whileHover={earned ? { scale: 1.05 } : undefined}
      className={`relative p-3 rounded-2xl border text-center transition-all duration-300 ${
        earned 
          ? `${tierStyle.bg} ${tierStyle.border} shadow-lg ${tierStyle.glow}`
          : isDark 
            ? 'bg-white/[0.02] border-white/[0.04] opacity-40'
            : 'bg-black/[0.02] border-black/[0.04] opacity-40'
      }`}
    >
      <div className="text-2xl mb-1">{badge.emoji}</div>
      <p className={`text-[10px] font-bold truncate ${earned ? '' : isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
        {badge.name}
      </p>
      <p className={`text-[8px] mt-0.5 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
        {badge.requiredStreak} วัน
      </p>
      {!earned && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg opacity-40">🔒</span>
        </div>
      )}
    </motion.div>
  );
}

// ── Main StreakDashboard Component ────────────────────────────
interface StreakDashboardProps {
  isDark: boolean;
  compact?: boolean; // For embedding in main dashboard
}

export function StreakDashboard({ isDark, compact = false }: StreakDashboardProps) {
  const [streaks, setStreaks] = useState<StreakRecord[]>([]);
  const [badges, setBadges] = useState<(BadgeDefinition & { earned: boolean; earnedAt?: number })[]>([]);
  const [score, setScore] = useState(0);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const cardBg = isDark ? 'glass-card' : 'glass-card-light';
  const textMuted = isDark ? 'text-zinc-500' : 'text-zinc-400';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [streakData, badgeData, scoreData] = await Promise.all([
      getAllStreaks(),
      getAllBadgesWithStatus(),
      getGamificationScore(),
    ]);
    setStreaks(streakData);
    setBadges(badgeData);
    setScore(scoreData);
  };

  const earnedBadges = badges.filter(b => b.earned);
  const totalStreakDays = streaks.reduce((sum, s) => sum + s.currentStreak, 0);

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Score Banner */}
        <div className={`${cardBg} bento-card p-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'} text-yellow-500`}>
              <Trophy size={20} />
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>Gamification Score</p>
              <p className="text-lg font-bold">{score} <span className={`text-xs ${textMuted}`}>pts</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              {earnedBadges.slice(0, 3).map(b => (
                <span key={b.id} className="text-sm">{b.emoji}</span>
              ))}
            </div>
            {earnedBadges.length > 3 && (
              <span className={`text-[9px] font-bold ${textMuted}`}>+{earnedBadges.length - 3}</span>
            )}
          </div>
        </div>

        {/* Streak Cards Grid */}
        {streaks.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {streaks.slice(0, 3).map(s => (
              <StreakCard key={s.type} streak={s} isDark={isDark} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center">
            <Trophy size={16} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg">ความสำเร็จ</h3>
            <p className={`text-[10px] ${textMuted}`}>สะสมแต้มและเหรียญรางวัล</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-yellow-500">{score}</p>
          <p className={`text-[9px] font-bold uppercase tracking-wider ${textMuted}`}>Points</p>
        </div>
      </div>

      {/* Streak Summary */}
      <div className={`${cardBg} bento-card p-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <Star size={20} className="text-yellow-500" />
          <div>
            <p className="font-bold">Total Active Streaks</p>
            <p className={`text-xs ${textMuted}`}>{totalStreakDays} วันรวมกัน</p>
          </div>
        </div>
        <p className="text-2xl font-bold">{streaks.filter(s => s.currentStreak > 0).length}</p>
      </div>

      {/* Streak Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {streaks.map(s => (
          <StreakCard key={s.type} streak={s} isDark={isDark} />
        ))}
      </div>

      {/* Badges Section */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-bold">เหรียญรางวัล</h3>
          <button 
            onClick={() => setShowAllBadges(!showAllBadges)}
            className={`text-xs font-bold flex items-center gap-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}
          >
            {showAllBadges ? 'ซ่อน' : `ดูทั้งหมด (${badges.length})`}
            <ChevronRight size={14} className={`transition-transform ${showAllBadges ? 'rotate-90' : ''}`} />
          </button>
        </div>
        
        {/* Earned badges */}
        <div className="grid grid-cols-4 gap-2">
          {(showAllBadges ? badges : earnedBadges.slice(0, 8)).map(badge => (
            <BadgeCard key={badge.id} badge={badge} earned={badge.earned} isDark={isDark} />
          ))}
        </div>

        {earnedBadges.length === 0 && (
          <div className={`text-center py-8 rounded-2xl border border-dashed ${
            isDark ? 'text-zinc-600 border-white/[0.06]' : 'text-zinc-400 border-black/[0.06]'
          }`}>
            <Trophy size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">ยังไม่มีเหรียญรางวัล</p>
            <p className="text-xs opacity-60 mt-1">เริ่มสะสม Streak เพื่อรับเหรียญแรก!</p>
          </div>
        )}
      </div>
    </div>
  );
}
