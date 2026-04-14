import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Flame, Droplets, Timer, TrendingDown, Target, Zap, Heart, Moon,
  Wind, Bot, Cloud, CloudOff, Sparkles, ArrowUpRight, GripVertical, Eye, EyeOff,
  Settings2, Sunrise, Sun, Sunset, MoonStar, Trophy, Wifi, WifiOff, Brain,
  TrendingUp, AlertCircle, ChevronRight, Bolt
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  db, type FoodLog, type WaterLog, type BodyMetric, type Vital,
  type StepLog, type SleepLog, type FastingSession, type DashboardWidget
} from '../lib/db';
import { haptics } from '../lib/haptics';
import { useAppStore, type TabName, type DailyMetrics } from '../lib/store';
import { format, parse, differenceInMinutes } from 'date-fns';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { firebaseService } from '../lib/firebaseService';
import { where, orderBy, limit } from 'firebase/firestore';
import { StreakDashboard } from './StreakBadges';
import {
  calculateRecoveryScore, calculateStrainScore, computeHabitCorrelations,
  getRecoveryRecommendation, generateAgenticInterventions,
  type RecoveryInput, type StrainInput, type DaySnapshot, type CognitiveInput
} from '../lib/healthAlgorithms';
import { generateDailyInsight } from '../lib/gemini';
import type { HabitCompletion, Habit, Workout } from '../lib/db';

// ── Time-Aware Greeting ──────────────────────────────────────
function getTimeOfDay(): { greeting: string; icon: React.ReactNode; emphasis: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { greeting: 'สวัสดีตอนเช้า', icon: <Sunrise size={16} className="text-amber-400" />, emphasis: 'sleep' };
  } else if (hour >= 12 && hour < 17) {
    return { greeting: 'สวัสดีตอนบ่าย', icon: <Sun size={16} className="text-yellow-400" />, emphasis: 'calories' };
  } else if (hour >= 17 && hour < 21) {
    return { greeting: 'สวัสดีตอนเย็น', icon: <Sunset size={16} className="text-orange-400" />, emphasis: 'workout' };
  } else {
    return { greeting: 'ราตรีสวัสดิ์', icon: <MoonStar size={16} className="text-indigo-400" />, emphasis: 'fasting' };
  }
}

// ── Circular Progress Ring ────────────────────────────────────
function ProgressRing({
  progress, size = 56, stroke = 4, color = '#22c55e', color2, bgColor = 'rgba(255,255,255,0.06)', children, glowColor
}: {
  progress: number; size?: number; stroke?: number; color?: string; color2?: string;
  bgColor?: string; children?: React.ReactNode; glowColor?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;
  const gradId = `grad-${Math.abs(color.charCodeAt(1)) + (color2 ? color2.charCodeAt(1) : 0)}-${size}`;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {glowColor && (
        <div
          className="absolute inset-0 rounded-full blur-xl opacity-30"
          style={{ backgroundColor: glowColor, transform: 'scale(0.8)' }}
        />
      )}
      <svg className="progress-ring transform -rotate-90" width={size} height={size}>
        {color2 && (
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgColor} strokeWidth={stroke} />
        <circle
          className="transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color2 ? `url(#${gradId})` : color} strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {children}
      </div>
    </div>
  );
}

// ── Recovery/Strain Hero Card ─────────────────────────────────
function MetricRingCard({
  value, maxValue, label, labelTh, score, zone, gradientFrom, gradientTo,
  color, isDark, side, isLoading
}: {
  value: number; maxValue: number; label: string; labelTh: string;
  score: number; zone: string; gradientFrom: string; gradientTo: string;
  color: string; isDark: boolean; side: 'recovery' | 'strain'; isLoading: boolean;
}) {
  const pct = Math.round((value / maxValue) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: 'spring', stiffness: 120, damping: 18 }}
      className={`flex-1 rounded-[28px] p-5 flex flex-col items-center gap-3 relative overflow-hidden ${
        isDark
          ? 'bg-white/[0.04] border border-white/[0.07]'
          : 'bg-white border border-black/[0.05] shadow-sm'
      }`}
      style={{ backdropFilter: 'blur(20px)' }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${side === 'recovery' ? '30%' : '70%'} 40%, ${color}, transparent 70%)`
        }}
      />

      <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
        {label}
      </p>

      <div className="relative z-10">
        <ProgressRing
          progress={pct}
          size={130}
          stroke={10}
          color={gradientFrom}
          color2={gradientTo}
          bgColor={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
          glowColor={color}
        >
          <div className="text-center">
            {isLoading ? (
              <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color }} />
            ) : (
              <>
                <p className="text-3xl font-black tabular-nums leading-none" style={{ color }}>
                  {value}
                </p>
                <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {side === 'recovery' ? '/ 100' : '/ 21'}
                </p>
              </>
            )}
          </div>
        </ProgressRing>
      </div>

      <div className="text-center z-10">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          {labelTh}
        </div>
        <p className={`text-[10px] mt-1.5 font-semibold ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
          {zone}
        </p>
      </div>
    </motion.div>
  );
}

// ── Habit Correlation Badge ───────────────────────────────────
function CorrelationCard({ habit, isDark }: { habit: { habitName: string; recoveryImpactPct: number; color: string; predictiveInsight?: string }; isDark: boolean }) {
  const isPositive = habit.recoveryImpactPct >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex flex-col px-4 py-3 rounded-2xl ${
        isDark ? 'bg-white/[0.04] border border-white/[0.06]' : 'bg-white border border-black/[0.04] shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: habit.color }}
          />
          <span className={`text-sm font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            {habit.habitName}
          </span>
        </div>
        <div
          className={`flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full`}
          style={{
            backgroundColor: isPositive ? '#22c55e20' : '#ef444420',
            color: isPositive ? '#22c55e' : '#ef4444'
          }}
        >
          {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {isPositive ? '+' : ''}{habit.recoveryImpactPct}% recovery
        </div>
      </div>
      {habit.predictiveInsight && (
         <div className={`mt-2.5 pt-2.5 border-t ${isDark ? 'border-white/5' : 'border-black/5'}`}>
           <p className={`text-[11px] leading-relaxed font-semibold flex items-start gap-1.5 ${isDark ? 'text-zinc-400 text-violet-300' : 'text-zinc-600'}`}>
              <Brain size={12} className="mt-0.5 shrink-0 text-violet-500" />
              <span>{habit.predictiveInsight.replace(/\*\*/g, '')}</span>
           </p>
         </div>
      )}
    </motion.div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard() {
  const {
    user, theme, activeTab, setActiveTab, isGoogleFitConnected, firebaseUser,
    dashboardWidgets, reorderDashboardWidget, toggleDashboardWidget,
    isOnline, pendingSyncCount, syncStatus, triggerSync,
    dailyMetrics, setDailyMetrics
  } = useAppStore();
  const navigate = useNavigate();
  const aiCalledRef = React.useRef<string>(''); // tracks date AI was last called — prevents StrictMode double-fire
  const [isLoading, setIsLoading] = useState(true);
  const [isMetricsLoading, setIsMetricsLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const [stats, setStats] = useState({
    calories: 0,
    water: 0,
    fasting: 0,
    weight: 0,
    weightHistory: [] as any[],
    sleep: 0,
    sleepQuality: 3,
    heartRate: 72,
    steps: 0,
    fastingProtocol: '--',
    isFasting: false
  });
  const [showCustomize, setShowCustomize] = useState(false);
  const isDark = theme === 'dark';
  const timeOfDay = getTimeOfDay();

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    }
  }, [firebaseUser, activeTab]);

  // Defer chart mount until container has real pixel size
  // chartReady is set via double-rAF inside loadDashboardData after data loads

  const loadDashboardData = async () => {
    setIsLoading(true);
    setIsMetricsLoading(true);
    setChartReady(false); // reset chart until DOM has real dimensions
    const today = format(new Date(), 'yyyy-MM-dd');
    let foods: FoodLog[] = [];
    let water: WaterLog[] = [];
    let weights: BodyMetric[] = [];
    let sleep: SleepLog | undefined;
    let vitals: Vital[] = [];
    let steps: StepLog | undefined;
    let workouts: Workout[] = [];
    let habits: Habit[] = [];
    let completions: HabitCompletion[] = [];

    if (firebaseUser) {
      const [foodData, waterData, weightData, sleepData, vitalData, stepData, workoutData, habitData, completionData] = await Promise.all([
        firebaseService.getCollection<FoodLog>('foodLogs', firebaseUser.uid, [where('date', '==', today)]),
        firebaseService.getCollection<WaterLog>('waterLogs', firebaseUser.uid, [where('date', '==', today)]),
        firebaseService.getCollection<BodyMetric>('bodyMetrics', firebaseUser.uid, [orderBy('date', 'desc'), limit(7)]),
        firebaseService.getCollection<SleepLog>('sleepLogs', firebaseUser.uid, [where('date', '==', today), limit(1)]),
        firebaseService.getCollection<Vital>('vitals', firebaseUser.uid, [where('date', '==', today)]),
        firebaseService.getCollection<StepLog>('stepLogs', firebaseUser.uid, [where('date', '==', today), limit(1)]),
        firebaseService.getCollection<Workout>('workouts', firebaseUser.uid, [where('date', '==', today)]),
        firebaseService.getCollection<Habit>('habits', firebaseUser.uid),
        firebaseService.getCollection<HabitCompletion>('habitCompletions', firebaseUser.uid),
      ]);
      foods = foodData; water = waterData; weights = weightData.reverse();
      sleep = sleepData[0]; vitals = vitalData; steps = stepData[0];
      workouts = workoutData; habits = habitData; completions = completionData;
    } else {
      [foods, water, weights, vitals, workouts, habits, completions] = await Promise.all([
        db.foodLogs.where('date').equals(today).toArray(),
        db.waterLogs.where('date').equals(today).toArray(),
        db.bodyMetrics.orderBy('date').limit(7).toArray(),
        db.vitals.where('date').equals(today).toArray(),
        db.workouts.where('date').equals(today).toArray(),
        db.habits.toArray(),
        db.habitCompletions.toArray(),
      ]);
      sleep = await db.sleepLogs.where('date').equals(today).first();
      steps = await db.stepLogs.where('date').equals(today).first();
    }

    // ── Calculate sleep hours ─────────────────────────────────
    let sleepHours = 0;
    let sleepQuality = 3;
    if (sleep) {
      try {
        const bed = parse(sleep.bedtime, 'HH:mm', new Date());
        let wake = parse(sleep.wakeTime, 'HH:mm', new Date());
        if (wake < bed) wake = new Date(wake.getTime() + 24 * 60 * 60 * 1000);
        sleepHours = differenceInMinutes(wake, bed) / 60;
        sleepQuality = sleep.quality || 3;
      } catch (e) { console.error('Sleep calc error:', e); }
    }

    // ── Active fasting ────────────────────────────────────────
    let activeFasting: FastingSession | undefined;
    if (firebaseUser) {
      const fastingData = await firebaseService.getCollection<FastingSession>('fastingSessions', firebaseUser.uid);
      activeFasting = fastingData.find(s => s.completed === 0);
    } else {
      activeFasting = await db.fastingSessions.where('completed').equals(0).first();
    }

    const heartRate = vitals.find(v => v.type === 'heart_rate')?.value1 || 72;
    const stepsCount = steps?.count || 0;

    const currentStats = {
      calories: foods.reduce((s, f) => s + f.calories, 0),
      water: water.reduce((s, w) => s + w.amountMl, 0),
      fasting: 0,
      weight: weights[weights.length - 1]?.weightKg || user?.weight || 84,
      weightHistory: weights.map(w => ({ date: format(new Date(w.date), 'MM/dd'), weight: w.weightKg })),
      sleep: parseFloat(sleepHours.toFixed(1)),
      sleepQuality,
      heartRate,
      steps: stepsCount,
      fastingProtocol: activeFasting?.protocol || '--',
      isFasting: !!activeFasting
    };

    setStats(currentStats);
    setIsLoading(false);
    // Two rAFs = browser completes layout before Recharts measures container
    requestAnimationFrame(() => requestAnimationFrame(() => setChartReady(true)));

    // ── Compute Recovery & Strain ─────────────────────────────
    const recoveryInput: RecoveryInput = {
      sleepDurationHours: sleepHours,
      sleepQuality,
      restingHeartRate: heartRate,
      hrv: null,
    };

    const strainInput: StrainInput = {
      workoutDurationMinutes: workouts.reduce((s, w) => s + (w.duration || 0), 0),
      workoutNames: workouts.map(w => w.name),
      stepsCount,
    };

    // Simulate Cognitive Input since there's no UI for it yet
    const cognitiveInput: CognitiveInput = {
       deepWorkMinutes: 100,
       meetingHours: 2,
       stressSelfReport: 5
    };

    const recovery = calculateRecoveryScore(recoveryInput);
    const strain = calculateStrainScore(strainInput, cognitiveInput);

    // ── Habit correlations (last 14 days) ────────────────────
    const last14Days: DaySnapshot[] = [];
    const today14 = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today14);
      d.setDate(d.getDate() - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayCompletions = completions.filter(c => c.date === dateStr);
      const habitsDone = dayCompletions
        .map(c => habits.find(h => h.id === c.habitId || String(h.id) === String(c.habitId))?.name)
        .filter(Boolean) as string[];
      // Simulate recovery for past days (not stored; use a decay from today)
      const dayRecovery = Math.max(20, Math.min(95, recovery.score + (Math.random() * 30 - 15)));
      last14Days.push({ 
        date: dateStr, 
        habitsDone, 
        recoveryScore: dayRecovery,
         // Adding cognitive load context for Bayesian Engine
         cognitiveStrain: Math.random() * 10
      });
    }

    const habitColors: Record<string, string> = {};
    habits.forEach(h => { if (h.name) habitColors[h.name] = h.color; });
    const habitNames = habits.map(h => h.name).filter(Boolean) as string[];
    const habitCorrelations = computeHabitCorrelations(last14Days, habitNames, habitColors);
    
    // Agentic Interventions
    const agenticInterventions = generateAgenticInterventions(recovery, strain);

    const metrics: DailyMetrics = {
      recovery, strain, habitCorrelations, agenticInterventions,
      aiInsight: getRecoveryRecommendation(recovery, strain),
      lastUpdated: today,
    };
    setDailyMetrics(metrics);
    setIsMetricsLoading(false);

    // ── AI Insight (async, non-blocking, rate-limited) ───────
    // Guard: only call API once per day — prevents React StrictMode double-fire (429)
    if (aiCalledRef.current !== today) {
      aiCalledRef.current = today;
      const aiInsightPromise = generateDailyInsight({
        recovery, strain,
        sleepHours, steps: stepsCount,
        calories: foods.reduce((s, f) => s + f.calories, 0),
        habitCorrelations,
      });
      aiInsightPromise.then(aiInsight => {
        setDailyMetrics({ ...metrics, aiInsight });
      }).catch(() => {});
    }
  }; // end loadDashboardData

  const healthScore = Math.round(
    ((Math.min(stats.calories / (user?.dailyCalorieTarget || 2200), 1) * 30) +
      (Math.min(stats.water / 2500, 1) * 30) +
      (Math.min(stats.steps / 10000, 1) * 20) +
      (stats.sleep >= 7 ? 20 : (stats.sleep / 7) * 20)) || 0
  );

  const cardBg = isDark ? 'glass-card' : 'glass-card-light';
  const textMuted = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const textSub = isDark ? 'text-zinc-400' : 'text-zinc-500';

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } }
  };

  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0 }
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-5 space-y-5 pb-32 max-w-2xl mx-auto">
        <div className="flex justify-between items-end px-1">
          <div className="space-y-2">
            <div className={`w-28 h-3 ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.04]'} rounded-full shimmer`} />
            <div className={`w-44 h-7 ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.04]'} rounded-full shimmer`} />
          </div>
          <div className={`w-14 h-14 ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.04]'} rounded-[1.2rem] shimmer`} />
        </div>
        <div className={`w-full h-[220px] ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.04]'} rounded-[2rem] shimmer`} />
        <div className="grid grid-cols-6 gap-3">
          <div className={`col-span-6 h-20 ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.04]'} rounded-[1.75rem] shimmer`} />
          <div className={`col-span-4 h-56 ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.04]'} rounded-[1.75rem] shimmer`} />
          <div className={`col-span-2 h-56 ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.04]'} rounded-[1.75rem] shimmer`} />
        </div>
      </div>
    );
  }

  const calorieProgress = Math.round((stats.calories / (user?.dailyCalorieTarget || 2200)) * 100);
  const waterProgress = Math.round((stats.water / 2500) * 100);
  const stepsProgress = Math.round((stats.steps / 10000) * 100);
  const emphasisWidget = timeOfDay.emphasis;

  // ── Widget renderer ───────────────────────────────────────────
  const renderWidget = (widgetId: string) => {
    const isEmphasized = emphasisWidget === widgetId;

    switch (widgetId) {
      case 'steps':
        return (
          <motion.div
            variants={item}
            whileHover={{ y: -4, scale: 1.01, transition: { duration: 0.2 } }}
            onClick={() => { haptics.light(); navigate('/metrics'); }}
            className={`col-span-6 rounded-[28px] p-6 flex items-center justify-between cursor-pointer group overflow-hidden relative shadow-lg ${
              isDark
                ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/5 border border-orange-500/20 ring-1 ring-white/5'
                : 'bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-orange-500/30'
            } ${isEmphasized ? 'ring-2 ring-orange-500 shadow-orange-500/40' : ''}`}
          >
            <div className="flex items-center gap-5 relative z-10 w-full">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-md ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-white/20 text-white shadow-inner'}`}>
                <Activity size={28} />
              </div>
              <div className="flex-1">
                <p className="text-4xl font-black tracking-tight tabular-nums drop-shadow-sm">
                  {stats.steps.toLocaleString()}
                  <span className={`text-sm font-bold ml-1.5 ${isDark ? 'text-orange-200/50' : 'text-orange-50'}`}>ก้าว</span>
                </p>
                <div className="flex items-center gap-3 mt-1.5 w-full max-w-[200px]">
                  <div className={`flex-1 h-2.5 rounded-full overflow-hidden backdrop-blur-sm ${isDark ? 'bg-black/40' : 'bg-black/20 shadow-inner'}`}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(stepsProgress, 100)}%` }}
                      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                      className={`h-full rounded-full ${isDark ? 'bg-gradient-to-r from-orange-400 to-amber-300' : 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]'}`}
                    />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-orange-200/70' : 'text-orange-50'}`}>{stepsProgress}%</span>
                </div>
              </div>
            </div>
            {isGoogleFitConnected && (
              <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full z-10 backdrop-blur-md ${isDark ? 'bg-green-500/20 text-green-300' : 'bg-white/20 text-white border border-white/30'}`}>
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-green-400' : 'bg-white'}`} />
                <span className="text-[9px] font-bold uppercase tracking-widest">Synced</span>
              </div>
            )}
            <Activity className={`absolute -right-4 -bottom-6 w-32 h-32 rotate-12 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 ease-out pointer-events-none drop-shadow-2xl ${isDark ? 'text-orange-500/10' : 'text-white/10'}`} />
          </motion.div>
        );

      case 'calories':
        return (
          <motion.div
            variants={item}
            whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
            onClick={() => { haptics.light(); navigate('/nutrition'); }}
            className={`col-span-6 sm:col-span-4 ${cardBg} p-5 rounded-[28px] flex flex-col justify-between cursor-pointer relative group min-h-[220px] shadow-lg border border-black/[0.03] dark:border-white/[0.03] ${isEmphasized ? 'ring-2 ring-red-500/50 shadow-red-500/20' : ''}`}
          >
            <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-red-500/20 to-orange-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-opacity duration-1000 group-hover:opacity-100 opacity-60`} />
            <div className={`absolute -right-2 bottom-0 p-4 transition-transform duration-700 ease-out group-hover:scale-110 group-hover:-rotate-6 pointer-events-none ${isDark ? 'text-red-500/5' : 'text-red-500/[0.03]'}`}>
              <Flame size={140} />
            </div>
            <div className="flex justify-between items-start relative z-10">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isDark ? 'bg-gradient-to-br from-red-500/20 to-orange-500/10 text-red-400 border border-red-500/20' : 'bg-gradient-to-br from-red-50 to-orange-50 text-red-500 border border-red-100'}`}>
                <Flame size={24} className="drop-shadow-sm" />
              </div>
              <div className="text-right">
                <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>พลังงานวันนี้</p>
                <div className={`inline-block px-2 py-0.5 rounded-full mt-1 ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
                  <p className="text-[10px] font-bold">เป้าหมาย {user?.dailyCalorieTarget || 2200}</p>
                </div>
              </div>
            </div>
            <div className="relative z-10 mt-6">
              <div className="flex items-baseline gap-2">
                <h2 className={`text-6xl font-black tracking-tighter tabular-nums bg-gradient-to-br ${isDark ? 'from-white to-zinc-400' : 'from-zinc-900 to-zinc-600'} text-transparent bg-clip-text`}>
                  {stats.calories}
                </h2>
                <span className={`${textMuted} text-sm font-bold uppercase tracking-widest`}>kcal</span>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-[10px] items-center font-bold uppercase tracking-wider">
                  <span className={textMuted}>ความคืบหน้า</span>
                  <span className="text-red-500">{calorieProgress}%</span>
                </div>
                <div className={`h-2.5 rounded-full overflow-hidden shadow-inner ${isDark ? 'bg-black/60' : 'bg-black/[0.04]'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(calorieProgress, 100)}%` }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        );

      case 'water':
        return (
          <motion.div
            variants={item}
            whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
            onClick={() => { haptics.light(); navigate('/nutrition'); }}
            className={`col-span-6 sm:col-span-2 ${cardBg} p-5 rounded-[28px] flex flex-col justify-between cursor-pointer group min-h-[220px] shadow-lg border border-black/[0.03] dark:border-white/[0.03] relative overflow-hidden`}
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-400/20 to-cyan-400/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none`} />
            <div className="flex justify-between items-start relative z-10 w-full">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isDark ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/10 text-cyan-400 border border-blue-500/20' : 'bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-500 border border-blue-100'}`}>
                <Droplets size={24} className="drop-shadow-sm" />
              </div>
              <div className={`px-2 py-0.5 rounded-full ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                <p className="text-[9px] font-bold uppercase">2.5L Goal</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center items-center py-2 relative z-10 w-full">
              <ProgressRing
                progress={waterProgress}
                size={110}
                stroke={8}
                color={isDark ? '#3b82f6' : '#2563eb'}
                color2={isDark ? '#06b6d4' : '#0891b2'}
                bgColor={isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)'}
              >
                <div className="text-center mt-2">
                  <p className="text-3xl font-black leading-none drop-shadow-sm tabular-nums">{stats.water}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted} mt-1`}>ml</p>
                </div>
              </ProgressRing>
            </div>
          </motion.div>
        );

      case 'heartRate':
        return (
          <motion.div
            variants={item}
            whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
            onClick={() => { haptics.light(); navigate('/metrics'); }}
            className={`col-span-3 sm:col-span-2 ${cardBg} p-4 rounded-[28px] flex flex-col justify-between cursor-pointer min-h-[140px] shadow-lg border border-black/[0.03] dark:border-white/[0.03] relative overflow-hidden`}
          >
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-red-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex justify-between items-center relative z-10 w-full">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${isDark ? 'bg-gradient-to-br from-red-500/20 to-rose-500/10 text-red-400 border border-red-500/20' : 'bg-gradient-to-br from-red-50 to-rose-50 text-red-500 border border-red-100'}`}>
                <Heart size={20} className="animate-pulse drop-shadow-sm" />
              </div>
              <Wind size={16} className={`${textMuted} opacity-50`} />
            </div>
            <div className="relative z-10 w-full mt-3">
              <p className="text-3xl font-black tabular-nums tracking-tighter drop-shadow-sm">{stats.heartRate}</p>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted} mt-0.5`}>BPM</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-red-500/5 to-transparent pointer-events-none" />
          </motion.div>
        );

      case 'sleep':
        return (
          <motion.div
            variants={item}
            whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
            onClick={() => { haptics.light(); navigate('/sleep'); }}
            className={`col-span-3 sm:col-span-2 ${cardBg} p-4 rounded-[28px] flex flex-col justify-between cursor-pointer min-h-[140px] shadow-lg border border-black/[0.03] dark:border-white/[0.03] relative overflow-hidden ${isEmphasized ? 'ring-2 ring-indigo-500/50 shadow-indigo-500/20' : ''}`}
          >
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex justify-between items-center relative z-10 w-full">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${isDark ? 'bg-gradient-to-br from-indigo-500/20 to-blue-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-500 border border-indigo-100'}`}>
                <Moon size={20} className="drop-shadow-sm" />
              </div>
              {isEmphasized && (
                <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full backdrop-blur-md">
                  ⚡ Focus
                </span>
              )}
            </div>
            <div className="relative z-10 w-full mt-3">
              <p className="text-3xl font-black tabular-nums tracking-tighter drop-shadow-sm">{stats.sleep || '--'}</p>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted} mt-0.5`}>Hours</p>
            </div>
          </motion.div>
        );

      case 'weight':
        return (
          <motion.div
            variants={item}
            whileHover={{ y: -4, scale: 1.01, transition: { duration: 0.2 } }}
            onClick={() => { haptics.light(); navigate('/metrics'); }}
            className={`col-span-6 sm:col-span-4 ${cardBg} p-5 rounded-[28px] flex flex-col justify-between cursor-pointer relative overflow-hidden min-h-[160px] shadow-lg border border-black/[0.03] dark:border-white/[0.03]`}
          >
            <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 rounded-full blur-2xl pointer-events-none`} />
            <div className="flex justify-between items-start relative z-10 w-full">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                    <TrendingDown size={12} />
                  </div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>น้ำหนัก</p>
                </div>
                <h3 className="text-3xl font-black tabular-nums tracking-tighter drop-shadow-sm">{stats.weight} <span className={`text-xs font-bold ${textMuted}`}>kg.</span></h3>
              </div>
              {user?.targetWeight && (
                <div className="text-right">
                  <div className={`inline-block px-2 py-0.5 rounded-full ${isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                    <p className={`text-[9px] font-bold uppercase tracking-widest`}>เป้าหมาย {user.targetWeight} kg</p>
                  </div>
                  <p className={`text-[10px] font-bold mt-1.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {stats.weight > user.targetWeight
                      ? `เหลืออีก ${(stats.weight - user.targetWeight).toFixed(1)} kg`
                      : '✓ บรรลุเป้าหมายแล้ว!'}
                  </p>
                </div>
              )}
            </div>
            <div className="h-[72px] w-[105%] -ml-[2.5%] -mb-5 mt-2 relative overflow-hidden">
              {stats.weightHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height={72} debounce={200}>
                  <AreaChart data={stats.weightHistory}>
                    <defs>
                      <linearGradient id="colorWeightDash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isDark ? '#10b981' : '#059669'} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={isDark ? '#10b981' : '#059669'} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="weightLineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone" dataKey="weight"
                      stroke="url(#weightLineGrad)" strokeWidth={3}
                      fillOpacity={1} fill="url(#colorWeightDash)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </motion.div>
        );

      case 'fasting':
        return (
          <motion.div
            variants={item}
            whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
            onClick={() => { haptics.light(); navigate('/fasting'); }}
            className={`col-span-6 sm:col-span-2 ${cardBg} p-4 rounded-[28px] flex items-center gap-4 cursor-pointer min-h-[80px] shadow-lg border border-black/[0.03] dark:border-white/[0.03] overflow-hidden relative ${isEmphasized ? 'ring-2 ring-cyan-500/50 shadow-cyan-500/20' : ''}`}
          >
            {stats.isFasting && <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent pointer-events-none" />}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner relative z-10 ${isDark ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-500 border border-cyan-100'}`}>
              <Timer size={24} className="drop-shadow-sm" />
            </div>
            <div className="relative z-10">
              <p className="text-xl font-black tabular-nums tracking-tight">{stats.fastingProtocol}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {stats.isFasting && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                <p className={`text-[10px] font-bold uppercase tracking-widest ${stats.isFasting ? (isDark ? 'text-cyan-400' : 'text-cyan-600') : textMuted}`}>
                  {stats.isFasting ? 'Fasting Now' : 'Fasting'}
                </p>
              </div>
            </div>
          </motion.div>
        );

      case 'streaks':
        return (
          <motion.div variants={item} className="col-span-6">
            <StreakDashboard isDark={isDark} compact />
          </motion.div>
        );

      case 'quickActions':
        return (
          <motion.div variants={item} className="col-span-6 mt-1">
            <section className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-base tracking-tight">ทางลัดด่วน</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'บันทึกอาหาร', icon: Flame, color: isDark ? 'text-orange-400' : 'text-orange-500', bg: isDark ? 'bg-orange-500/20' : 'bg-orange-50', border: isDark ? 'border-orange-500/20' : 'border-orange-100', tab: 'nutrition' },
                  { label: 'ออกกำลังกาย', icon: Activity, color: isDark ? 'text-red-400' : 'text-red-500', bg: isDark ? 'bg-red-500/20' : 'bg-red-50', border: isDark ? 'border-red-500/20' : 'border-red-100', tab: 'workout' },
                ].map((action, i) => (
                  <motion.button
                    key={i}
                    variants={item}
                    whileHover={{ y: -3, scale: 1.02, transition: { duration: 0.2 } }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { haptics.light(); navigate(`/${action.tab}`); }}
                    className={`${cardBg} p-4 rounded-[24px] flex items-center gap-4 group shadow-md border border-black/[0.03] dark:border-white/[0.03] overflow-hidden relative`}
                  >
                    <div className={`absolute -right-4 -bottom-4 w-16 h-16 ${action.bg} rounded-full blur-xl pointer-events-none opacity-50`} />
                    <div className={`w-12 h-12 ${action.bg} ${action.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner border ${action.border} relative z-10`}>
                      <action.icon size={22} className="drop-shadow-sm" />
                    </div>
                    <span className="font-bold text-sm tracking-tight relative z-10">{action.label}</span>
                  </motion.button>
                ))}
              </div>
            </section>
          </motion.div>
        );

      default:
        return null;
    }
  };

  const visibleWidgets = [...dashboardWidgets]
    .filter(w => w.visible)
    .sort((a, b) => a.order - b.order);

  const rec = dailyMetrics?.recovery;
  const str = dailyMetrics?.strain;
  const correlations = dailyMetrics?.habitCorrelations || [];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-5 space-y-5 pb-32 max-w-2xl mx-auto"
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="flex justify-between items-end px-2 pt-2">
        <div>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5 mb-2"
          >
            <div className={`p-2 rounded-xl ${isDark ? 'bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' : 'bg-black/[0.03] shadow-inner'} backdrop-blur-md`}>
              {timeOfDay.icon}
            </div>
            <p className={`${textMuted} text-[10px] font-bold uppercase tracking-[0.25em]`}>
              {format(new Date(), 'EEEE, d MMMM')}
            </p>
          </motion.div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-tight drop-shadow-sm">
            {timeOfDay.greeting},<br />
            <span className={`bg-gradient-to-r ${isDark ? 'from-green-400 via-emerald-400 to-teal-400' : 'from-green-500 via-emerald-600 to-teal-600'} text-transparent bg-clip-text`}>
              {user?.name?.split(' ')[0] || 'คุณ'}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { haptics.light(); setShowCustomize(!showCustomize); }}
            className={`p-3 rounded-2xl transition-all shadow-sm ${
              showCustomize
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/20'
                : isDark ? 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10' : 'bg-black/[0.03] border border-black/[0.05] text-zinc-500 hover:bg-black/[0.06]'
            }`}
          >
            <Settings2 size={18} />
          </motion.button>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative cursor-pointer flex items-center"
            onClick={() => { haptics.light(); navigate('/profile'); }}
          >
            <div className="flex flex-col items-end">
              <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest mb-1.5 ${
                firebaseUser ? 'text-green-500' : isOnline ? 'text-zinc-500' : 'text-red-500'
              }`}>
                {firebaseUser ? (
                  <><Cloud size={10} /><span className="bg-green-500/20 px-1.5 py-0.5 rounded backdrop-blur-sm">Online</span></>
                ) : isOnline ? (
                  <><CloudOff size={10} /><span>Local</span></>
                ) : (
                  <><WifiOff size={10} /><span>Offline</span></>
                )}
              </div>
              <ProgressRing
                progress={healthScore}
                size={58}
                stroke={5}
                color={isDark ? '#4ade80' : '#16a34a'}
                color2={isDark ? '#06b6d4' : '#0891b2'}
                bgColor={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
              >
                <span className={`text-sm font-black tabular-nums tracking-tighter ${isDark ? 'text-white' : 'text-zinc-900'} drop-shadow-md`}>{healthScore}</span>
              </ProgressRing>
            </div>
          </motion.div>
        </div>
      </header>

      {/* ── Sync status ───────────────────────────────────────── */}
      {pendingSyncCount > 0 && firebaseUser && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => triggerSync()}
          className={`w-full py-2 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
            syncStatus === 'syncing'
              ? 'bg-blue-500/10 text-blue-400'
              : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
          }`}
        >
          {syncStatus === 'syncing' ? (
            <><div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> กำลังซิงค์...</>
          ) : (
            <><Cloud size={14} /> {pendingSyncCount} รายการรอซิงค์ — แตะเพื่อซิงค์</>
          )}
        </motion.button>
      )}

      {/* ══════════════════════════════════════════════════════
           WHOOP-STYLE RECOVERY + STRAIN HERO PANEL
         ══════════════════════════════════════════════════════ */}
      <motion.section variants={item} className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className={`text-xs font-black uppercase tracking-[0.2em] ${textMuted}`}>วันนี้</h2>
          <button
            onClick={() => { haptics.light(); navigate('/sleep'); }}
            className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-zinc-400 hover:text-zinc-600'} transition-colors flex items-center gap-1`}
          >
            อัพเดตข้อมูล <ChevronRight size={10} />
          </button>
        </div>

        {/* Recovery + Strain dual ring */}
        <div className="flex gap-3">
          <MetricRingCard
            value={rec?.score ?? 0}
            maxValue={100}
            label="Recovery"
            labelTh={rec?.labelTh ?? 'คำนวณ...'}
            score={rec?.score ?? 0}
            zone={rec ? `${rec.breakdown.sleep + rec.breakdown.quality + rec.breakdown.hrv + rec.breakdown.rhr} pts` : '--'}
            gradientFrom={rec?.gradientFrom ?? '#6b7280'}
            gradientTo={rec?.gradientTo ?? '#9ca3af'}
            color={rec?.color ?? '#6b7280'}
            isDark={isDark}
            side="recovery"
            isLoading={isMetricsLoading}
          />
          <MetricRingCard
            value={str?.score ?? 0}
            maxValue={21}
            label="Allostatic Load"
            labelTh={str?.zoneTh ?? 'คำนวณ...'}
            score={str?.score ?? 0}
            zone={str ? `Physical ${str.physicalScore} / Cognitive ${str.cognitiveScore}` : '--'}
            gradientFrom={str?.gradientFrom ?? '#6b7280'}
            gradientTo={str?.gradientTo ?? '#9ca3af'}
            color={str?.color ?? '#6b7280'}
            isDark={isDark}
            side="strain"
            isLoading={isMetricsLoading}
          />
        </div>

        {/* AI Insight Banner */}
        {dailyMetrics?.aiInsight && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => { haptics.light(); navigate('/coach'); }}
            className={`w-full p-4 rounded-[20px] flex items-start gap-3 cursor-pointer group transition-all ${
              isDark
                ? 'bg-gradient-to-r from-violet-500/10 to-blue-500/5 border border-violet-500/20 hover:border-violet-500/40'
                : 'bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 hover:border-violet-300'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center ${
              isDark ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-100 text-violet-600'
            }`}>
              <Brain size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
                AI Coach Insight
              </p>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                {dailyMetrics.aiInsight}
              </p>
            </div>
            <ChevronRight size={16} className={`flex-shrink-0 ${isDark ? 'text-zinc-600 group-hover:text-zinc-400' : 'text-zinc-400 group-hover:text-zinc-600'} transition-colors`} />
          </motion.div>
        )}

        {/* Agentic Core Interventions */}
        {dailyMetrics?.agenticInterventions && dailyMetrics.agenticInterventions.length > 0 && (
          <motion.div
             initial={{ opacity: 0, y: 8 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.35 }}
             className="space-y-2 pb-1"
          >
             {dailyMetrics.agenticInterventions.map((intervention, idx) => (
                <div
                  key={idx}
                  onClick={() => { haptics.light(); navigate('/coach'); }}
                  className={`p-3.5 rounded-2xl flex items-start gap-3 cursor-pointer group border ${
                    isDark ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-white' : 'bg-red-50 border-red-200 hover:bg-red-100 text-zinc-900'
                  }`}
                >
                  <AlertCircle className={`mt-0.5 shrink-0 animate-pulse ${isDark ? 'text-red-400' : 'text-red-500'}`} size={16} />
                  <div>
                     <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-red-400' : 'text-red-600'}`}>Agent Action Required</p>
                     <p className={`text-xs font-semibold leading-relaxed ${isDark ? 'text-red-100' : 'text-red-900'}`}>{intervention.uiPrompt}</p>
                  </div>
                </div>
             ))}
          </motion.div>
        )}

        {/* Recovery breakdown bar */}
        {rec && !isMetricsLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className={`p-4 rounded-[20px] space-y-2.5 ${
              isDark ? 'bg-white/[0.03] border border-white/[0.05]' : 'bg-black/[0.02] border border-black/[0.04]'
            }`}
          >
            <p className={`text-[10px] font-black uppercase tracking-widest ${textMuted}`}>Recovery Breakdown (Z-Scores)</p>
            {[
              { label: 'Sleep Deprivation', pts: rec.zScores.sleep, min: -3, max: 3, color: '#6366f1' },
              { label: 'Nervous System (HRV)', pts: rec.zScores.hrv, min: -3, max: 3, color: '#14b8a6' },
              { label: 'Cardiac Stress (RHR)', pts: rec.zScores.rhr, min: -3, max: 3, color: '#ec4899' },
            ].map((item) => {
              const progress = Math.min(Math.max(((item.pts - item.min) / (item.max - item.min)) * 100, 0), 100);
              return (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className={textMuted}>{item.label}</span>
                  <span className="font-bold" style={{ color: item.color }}>{item.pts > 0 ? '+' : ''}{item.pts}σ</span>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden relative ${isDark ? 'bg-white/[0.05]' : 'bg-black/[0.05]'}`}>
                  <div className={`absolute top-0 bottom-0 w-0.5 bg-red-500/50 left-[50%] z-10`} />
                  <motion.div
                    initial={{ width: '50%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                </div>
              </div>
              );
            })}
          </motion.div>
        )}

        {/* Habit Correlations */}
        {correlations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between px-1">
              <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${textMuted}`}>
                Habit Impact on Recovery
              </p>
              <Zap size={12} className="text-yellow-500" />
            </div>
            {correlations.map((h, i) => (
              <CorrelationCard key={i} habit={h} isDark={isDark} />
            ))}
          </motion.div>
        )}
      </motion.section>

      {/* ── Customize panel ───────────────────────────────────── */}
      <AnimatePresence>
        {showCustomize && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`${cardBg} bento-card p-4 space-y-3`}>
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-green-500" />
                <p className="text-sm font-bold">ปรับแต่ง Dashboard</p>
              </div>
              <p className={`text-[10px] ${textMuted}`}>เปิด/ปิดการ์ดที่ต้องการแสดง</p>
              <div className="grid grid-cols-2 gap-2">
                {dashboardWidgets.map((widget) => (
                  <button
                    key={widget.id}
                    onClick={() => { haptics.light(); toggleDashboardWidget(widget.id); }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all border ${
                      widget.visible
                        ? isDark ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-green-50 border-green-200 text-green-600'
                        : isDark ? 'bg-white/[0.03] border-white/[0.04] text-zinc-600' : 'bg-black/[0.02] border-black/[0.04] text-zinc-400'
                    }`}
                  >
                    {widget.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    {widget.id === 'steps' ? 'ก้าวเดิน' :
                      widget.id === 'calories' ? 'แคลอรี่' :
                        widget.id === 'water' ? 'น้ำ' :
                          widget.id === 'heartRate' ? 'อัตราหัวใจ' :
                            widget.id === 'sleep' ? 'การนอน' :
                              widget.id === 'weight' ? 'น้ำหนัก' :
                                widget.id === 'fasting' ? 'IF' :
                                  widget.id === 'streaks' ? 'สถิติ/เหรียญ' :
                                    widget.id === 'quickActions' ? 'ทางลัด' : widget.id}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bento Grid — Dynamic Widgets ─────────────────────── */}
      <div className="grid grid-cols-6 gap-3 auto-rows-min">
        {visibleWidgets.map((widget) => (
          <React.Fragment key={widget.id}>
            {renderWidget(widget.id)}
          </React.Fragment>
        ))}
      </div>
    </motion.div>
  );
}
