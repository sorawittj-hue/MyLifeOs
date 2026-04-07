import React, { useState, useEffect } from 'react';
import { Activity, Flame, Droplets, Timer, TrendingDown, Target, Zap, Heart, Moon, Wind, Bot, Cloud, CloudOff, Sparkles, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, type FoodLog, type WaterLog, type BodyMetric, type Vital, type StepLog, type SleepLog, type FastingSession } from '../lib/db';
import { haptics } from '../lib/haptics';
import { useAppStore, type TabName } from '../lib/store';
import { format, parse, differenceInMinutes } from 'date-fns';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { generateDailyInsight } from '../lib/gemini';
import { firebaseService } from '../lib/firebaseService';
import { where, orderBy, limit } from 'firebase/firestore';

// Circular Progress Ring Component
function ProgressRing({ progress, size = 56, stroke = 4, color = '#22c55e', bgColor = 'rgba(255,255,255,0.06)', children }: {
  progress: number; size?: number; stroke?: number; color?: string; bgColor?: string; children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;
  
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="progress-ring" width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={bgColor} strokeWidth={stroke} />
        <circle
          className="progress-ring__circle"
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, theme, activeTab, setActiveTab, isGoogleFitConnected, firebaseUser, insightCache, setInsightCache } = useAppStore();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    calories: 0,
    water: 0,
    fasting: 0,
    weight: 0,
    weightHistory: [] as any[],
    sleep: 0,
    heartRate: 72,
    steps: 0,
    fastingProtocol: '--',
    isFasting: false
  });
  const [insight, setInsight] = useState<string | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    }
  }, [firebaseUser, activeTab]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    let foods: FoodLog[] = [];
    let water: WaterLog[] = [];
    let weights: BodyMetric[] = [];
    let sleep: SleepLog | undefined;
    let vitals: Vital[] = [];
    let steps: StepLog | undefined;

    if (firebaseUser) {
      const foodData = await firebaseService.getCollection<FoodLog>('foodLogs', firebaseUser.uid, [
        where('date', '==', today)
      ]);
      foods = foodData;
      
      const waterData = await firebaseService.getCollection<WaterLog>('waterLogs', firebaseUser.uid, [
        where('date', '==', today)
      ]);
      water = waterData;
      
      const weightData = await firebaseService.getCollection<BodyMetric>('bodyMetrics', firebaseUser.uid, [
        orderBy('date', 'desc'),
        limit(7)
      ]);
      weights = weightData.reverse();
      
      const sleepData = await firebaseService.getCollection<SleepLog>('sleepLogs', firebaseUser.uid, [
        where('date', '==', today),
        limit(1)
      ]);
      sleep = sleepData[0];
      
      const vitalData = await firebaseService.getCollection<Vital>('vitals', firebaseUser.uid, [
        where('date', '==', today)
      ]);
      vitals = vitalData;
      
      const stepData = await firebaseService.getCollection<StepLog>('stepLogs', firebaseUser.uid, [
        where('date', '==', today),
        limit(1)
      ]);
      steps = stepData[0];
    } else {
      foods = await db.foodLogs.where('date').equals(today).toArray();
      water = await db.waterLogs.where('date').equals(today).toArray();
      weights = await db.bodyMetrics.orderBy('date').limit(7).toArray();
      sleep = await db.sleepLogs.where('date').equals(today).first();
      vitals = await db.vitals.where('date').equals(today).toArray();
      steps = await db.stepLogs.where('date').equals(today).first();
    }
    
    const calTotal = foods.reduce((s, f) => s + f.calories, 0);
    const waterTotal = water.reduce((s, w) => s + w.amountMl, 0);
    
    let sleepHours = 0;
    if (sleep) {
      try {
        const bed = parse(sleep.bedtime, 'HH:mm', new Date());
        let wake = parse(sleep.wakeTime, 'HH:mm', new Date());
        if (wake < bed) {
          wake = new Date(wake.getTime() + 24 * 60 * 60 * 1000);
        }
        const minutes = differenceInMinutes(wake, bed);
        sleepHours = minutes / 60;
      } catch (e) {
        console.error('Sleep calculation error:', e);
      }
    }

    // Load active fasting session
    let activeFasting: FastingSession | undefined;
    if (firebaseUser) {
      const fastingData = await firebaseService.getCollection<FastingSession>('fastingSessions', firebaseUser.uid);
      activeFasting = fastingData.find(s => s.completed === 0);
    } else {
      activeFasting = await db.fastingSessions.where('completed').equals(0).first();
    }

    const currentStats = {
      calories: calTotal,
      water: waterTotal,
      fasting: 0,
      weight: weights[weights.length - 1]?.weightKg || user?.weight || 84,
      weightHistory: weights.map(w => ({ date: format(new Date(w.date), 'MM/dd'), weight: w.weightKg })),
      sleep: parseFloat(sleepHours.toFixed(1)),
      heartRate: vitals.find(v => v.type === 'heart_rate')?.value1 || 72,
      steps: steps?.count || 0,
      fastingProtocol: activeFasting?.protocol || '--',
      isFasting: !!activeFasting
    };

    setStats(currentStats);
    setIsLoading(false);

    // Generate AI Insight (with caching)
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (insightCache?.date === todayStr && insightCache.text) {
      setInsight(insightCache.text);
    } else {
      setIsInsightLoading(true);
      try {
        const aiInsight = await generateDailyInsight({
          user,
          todayStats: {
            calories: calTotal,
            water: waterTotal,
            sleep: sleepHours,
            vitals
          }
        });
        setInsight(aiInsight);
        setInsightCache({ text: aiInsight, date: todayStr });
      } catch (error) {
        console.error('Failed to generate insight:', error);
      } finally {
        setIsInsightLoading(false);
      }
    }
  };

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
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0 }
  };

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

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="p-5 space-y-5 pb-32 max-w-2xl mx-auto"
    >
      {/* Header */}
      <header className="flex justify-between items-end px-1">
        <div>
          <motion.p 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`${textMuted} text-[10px] font-semibold uppercase tracking-[0.2em] mb-1`}
          >
            {format(new Date(), 'EEEE, d MMMM')}
          </motion.p>
          <h1 className="text-3xl font-bold tracking-tight">
            สวัสดี, <span className={isDark ? 'text-gradient-green' : 'text-green-600'}>{user?.name?.split(' ')[0] || 'คุณ'}</span>
          </h1>
        </div>
        <motion.div 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative cursor-pointer flex items-center gap-3"
          onClick={() => {
            haptics.light();
            navigate('/profile');
          }}
        >
          <div className="flex flex-col items-end">
            {firebaseUser ? (
              <div className="flex items-center gap-1 text-[9px] font-semibold text-green-400 uppercase tracking-wider mb-1">
                <Cloud size={9} />
                <span>Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-1">
                <CloudOff size={9} />
                <span>Local</span>
              </div>
            )}
            <ProgressRing 
              progress={healthScore} 
              size={52} 
              stroke={3.5}
              color={isDark ? '#4ade80' : '#16a34a'}
              bgColor={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
            >
              <span className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{healthScore}</span>
            </ProgressRing>
          </div>
        </motion.div>
      </header>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-6 gap-3 auto-rows-min">
        
        {/* Steps Banner */}
        <motion.div 
          variants={item}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          onClick={() => {
            haptics.light();
            navigate('/metrics');
          }}
          className={`col-span-6 ${cardBg} bento-card p-4 flex items-center justify-between cursor-pointer group overflow-hidden relative`}
        >
          <div className="flex items-center gap-4 relative z-10">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'} text-orange-500`}>
              <Activity size={20} />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">
                {stats.steps.toLocaleString()} 
                <span className={`text-xs font-normal ml-1 ${textMuted}`}>ก้าว</span>
              </p>
              <div className="flex items-center gap-2">
                <div className={`w-24 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(stepsProgress, 100)}%` }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full" 
                  />
                </div>
                <span className={`text-[10px] font-medium ${textMuted}`}>เป้าหมาย 10,000</span>
              </div>
            </div>
          </div>
          {isGoogleFitConnected && (
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full relative z-10 ${isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'}`}>
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">Synced</span>
            </div>
          )}
          <Activity className={`absolute -right-4 -bottom-4 w-20 h-20 rotate-12 group-hover:scale-110 transition-transform duration-500 ${isDark ? 'text-orange-500/[0.04]' : 'text-orange-500/[0.06]'}`} />
        </motion.div>

        {/* Calories - Large Bento */}
        <motion.div 
          variants={item}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          onClick={() => {
            haptics.light();
            navigate('/nutrition');
          }}
          className={`col-span-6 sm:col-span-4 ${cardBg} bento-card p-5 flex flex-col justify-between cursor-pointer relative group min-h-[220px]`}
        >
          <div className={`absolute top-0 right-0 p-6 transition-opacity duration-500 ${isDark ? 'opacity-[0.03]' : 'opacity-[0.05]'} group-hover:opacity-[0.08]`}>
            <Flame size={100} className="text-nutrition" />
          </div>
          <div className="flex justify-between items-start relative z-10">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'} text-nutrition`}>
              <Flame size={22} />
            </div>
            <div className="text-right">
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${textMuted}`}>พลังงานวันนี้</p>
              <p className="text-xs font-medium text-nutrition">เป้าหมาย {user?.dailyCalorieTarget || 2200}</p>
            </div>
          </div>
          <div className="relative z-10">
            <div className="flex items-baseline gap-2">
              <h2 className="text-4xl font-bold tracking-tighter">{stats.calories}</h2>
              <span className={`${textMuted} text-sm font-medium`}>kcal</span>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[10px] font-semibold">
                <span className={textMuted}>ความคืบหน้า</span>
                <span className="text-nutrition">{calorieProgress}%</span>
              </div>
              <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(calorieProgress, 100)}%` }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full bg-gradient-to-r from-nutrition to-amber-400 rounded-full"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Water - Vertical Bento */}
        <motion.div 
          variants={item}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          onClick={() => {
            haptics.light();
            navigate('/nutrition');
          }}
          className={`col-span-6 sm:col-span-2 ${cardBg} bento-card p-5 flex flex-col justify-between cursor-pointer group min-h-[220px]`}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'} text-water`}>
            <Droplets size={22} />
          </div>
          <div className="flex-1 flex flex-col justify-center items-center py-3">
            <ProgressRing 
              progress={waterProgress} 
              size={80} 
              stroke={5}
              color="#60a5fa"
              bgColor={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
            >
              <div className="text-center">
                <p className="text-lg font-bold leading-none">{stats.water}</p>
                <p className={`text-[8px] font-semibold ${textMuted}`}>มล.</p>
              </div>
            </ProgressRing>
          </div>
          <p className={`text-[10px] text-center font-medium ${isDark ? 'text-blue-400' : 'text-blue-500'}`}>เป้าหมาย 2.5L</p>
        </motion.div>

        {/* Heart Rate */}
        <motion.div 
          variants={item}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          onClick={() => {
            haptics.light();
            navigate('/metrics');
          }}
          className={`col-span-3 sm:col-span-2 ${cardBg} bento-card p-4 flex flex-col justify-between cursor-pointer min-h-[130px]`}
        >
          <div className="flex justify-between items-center">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-red-500/10' : 'bg-red-50'} text-activity`}>
              <Heart size={18} className="animate-pulse" />
            </div>
            <Wind size={14} className={textMuted} />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.heartRate}</p>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${textMuted}`}>BPM</p>
          </div>
        </motion.div>

        {/* Sleep */}
        <motion.div 
          variants={item}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          onClick={() => {
            haptics.light();
            navigate('/sleep');
          }}
          className={`col-span-3 sm:col-span-2 ${cardBg} bento-card p-4 flex flex-col justify-between cursor-pointer min-h-[130px]`}
        >
          <div className="flex justify-between items-center">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'} text-sleep`}>
              <Moon size={18} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.sleep || '--'}</p>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${textMuted}`}>ชั่วโมง</p>
          </div>
        </motion.div>

        {/* Weight Trend */}
        <motion.div 
          variants={item}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          onClick={() => {
            haptics.light();
            navigate('/metrics');
          }}
          className={`col-span-6 sm:col-span-4 ${cardBg} bento-card p-5 flex flex-col justify-between cursor-pointer relative overflow-hidden min-h-[160px]`}
        >
          <div className="flex justify-between items-center relative z-10">
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${textMuted}`}>น้ำหนัก</p>
              <h3 className="text-2xl font-bold">{stats.weight} <span className={`text-xs font-normal ${textMuted}`}>กก.</span></h3>
            </div>
            {user?.targetWeight && (
              <div className="text-right">
                <p className={`text-[10px] font-semibold uppercase tracking-widest ${isDark ? 'text-green-400' : 'text-green-600'}`}>เป้าหมาย {user.targetWeight} กก.</p>
                <p className={`text-xs ${textMuted}`}>
                  {stats.weight > user.targetWeight 
                    ? `เหลืออีก ${(stats.weight - user.targetWeight).toFixed(1)} กก.`
                    : 'บรรลุเป้าหมายแล้ว! 🎉'}
                </p>
              </div>
            )}
          </div>
          <div className="h-16 w-full mt-2" style={{ minWidth: 0 }}>
            {stats.weightHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={1}>
                <AreaChart data={stats.weightHistory}>
                  <defs>
                    <linearGradient id="colorWeightDash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isDark ? '#4ade80' : '#16a34a'} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={isDark ? '#4ade80' : '#16a34a'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="weight" 
                    stroke={isDark ? '#4ade80' : '#16a34a'}
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorWeightDash)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </motion.div>

        {/* Fasting */}
        <motion.div 
          variants={item}
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          onClick={() => {
            haptics.light();
            navigate('/fasting');
          }}
          className={`col-span-6 sm:col-span-2 ${cardBg} bento-card p-4 flex items-center gap-3 cursor-pointer min-h-[70px]`}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'} text-fasting`}>
            <Timer size={16} />
          </div>
          <div>
            <p className="text-sm font-bold">{stats.fastingProtocol}</p>
            <p className={`text-[9px] font-semibold uppercase tracking-widest ${stats.isFasting ? (isDark ? 'text-green-400' : 'text-green-600') : textMuted}`}>
              {stats.isFasting ? '🔴 Fasting Now' : 'Fasting'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* AI Insight Banner */}
      <motion.div 
        variants={item}
        whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
        className="relative group cursor-pointer"
        onClick={() => {
          haptics.light();
          navigate('/coach');
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-500" />
        <div className="bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 p-5 rounded-[1.75rem] flex gap-4 items-center shadow-xl shadow-green-500/10 relative overflow-hidden animate-gradient">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZG90IiB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxjaXJjbGUgY3g9IjIiIGN5PSIyIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSJ1cmwoI2RvdCkiLz48L3N2Zz4=')] opacity-30" />
          <div className="w-12 h-12 bg-white/15 backdrop-blur-md rounded-xl flex items-center justify-center flex-shrink-0 border border-white/20">
            <Sparkles size={22} className="text-white" />
          </div>
          <div className="space-y-0.5 relative z-10 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-white/60 text-[9px] font-semibold uppercase tracking-[0.2em]">AI Insight</p>
              <ArrowUpRight size={12} className="text-white/40" />
            </div>
            <p className="text-white/95 font-medium text-[13px] leading-snug">
              {isInsightLoading ? "กำลังวิเคราะห์ข้อมูลของคุณ..." : (insight || "ลองดื่มน้ำเพิ่มขึ้นอีกนิดในวันนี้ เพื่อช่วยให้ร่างกายสดชื่นและเผาผลาญได้ดีขึ้นครับ")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <section className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-bold text-base tracking-tight">ทางลัดด่วน</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'บันทึกอาหาร', icon: Flame, color: isDark ? 'text-orange-400' : 'text-orange-500', bg: isDark ? 'bg-orange-500/10' : 'bg-orange-50', tab: 'nutrition' },
            { label: 'ออกกำลังกาย', icon: Activity, color: isDark ? 'text-red-400' : 'text-red-500', bg: isDark ? 'bg-red-500/10' : 'bg-red-50', tab: 'workout' },
          ].map((action, i) => (
            <motion.button 
              key={i}
              variants={item}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                haptics.light();
                navigate(`/${action.tab}`);
              }}
              className={`${cardBg} p-4 bento-card flex items-center gap-3 group`}
            >
              <div className={`w-10 h-10 ${action.bg} ${action.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <action.icon size={20} />
              </div>
              <span className="font-semibold text-sm">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
