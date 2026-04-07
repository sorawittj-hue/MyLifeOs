import React, { useState, useEffect } from 'react';
import { Activity, Flame, Droplets, Timer, ChevronRight, TrendingDown, Target, Zap, Heart, Moon, Wind, Bot, Cloud, CloudOff } from 'lucide-react';
import { db, type FoodLog, type WaterLog, type BodyMetric, type Vital, type StepLog, type SleepLog } from '../lib/db';
import { haptics } from '../lib/haptics';
import { useAppStore } from '../lib/store';
import { format, startOfDay, endOfDay } from 'date-fns';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, AreaChart, Area } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { generateDailyInsight } from '../lib/gemini';
import { firebaseService } from '../lib/firebaseService';

export default function Dashboard() {
  const { user, theme, activeTab, setActiveTab, isGoogleFitConnected, firebaseUser } = useAppStore();
  const [stats, setStats] = useState({
    calories: 0,
    water: 0,
    fasting: 0,
    weight: 0,
    weightHistory: [] as any[],
    sleep: 0,
    heartRate: 72,
    steps: 0
  });
  const [insight, setInsight] = useState<string | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
    }
  }, [firebaseUser, activeTab]);

  const loadDashboardData = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    let foods: FoodLog[] = [];
    let water: WaterLog[] = [];
    let weights: BodyMetric[] = [];
    let sleep: SleepLog | undefined;
    let vitals: Vital[] = [];
    let steps: StepLog | undefined;

    if (firebaseUser) {
      const foodData = await firebaseService.getCollection<FoodLog>('foodLogs', firebaseUser.uid);
      foods = foodData.filter(f => f.date === today);
      
      const waterData = await firebaseService.getCollection<WaterLog>('waterLogs', firebaseUser.uid);
      water = waterData.filter(w => w.date === today);
      
      const weightData = await firebaseService.getCollection<BodyMetric>('bodyMetrics', firebaseUser.uid);
      weights = weightData.sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
      
      const sleepData = await firebaseService.getCollection<SleepLog>('sleepLogs', firebaseUser.uid);
      sleep = sleepData.find(s => s.date === today);
      
      const vitalData = await firebaseService.getCollection<Vital>('vitals', firebaseUser.uid);
      vitals = vitalData.filter(v => v.date === today);
      
      const stepData = await firebaseService.getCollection<StepLog>('stepLogs', firebaseUser.uid);
      steps = stepData.find(s => s.date === today);
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
      const bed = new Date(`2000-01-01T${sleep.bedtime}`);
      const wake = new Date(`2000-01-01T${sleep.wakeTime}`);
      if (wake < bed) wake.setDate(wake.getDate() + 1);
      sleepHours = (wake.getTime() - bed.getTime()) / (1000 * 60 * 60);
    }

    const currentStats = {
      calories: calTotal,
      water: waterTotal,
      fasting: 14,
      weight: weights[weights.length - 1]?.weightKg || user?.weight || 84,
      weightHistory: weights.map(w => ({ date: format(new Date(w.date), 'MM/dd'), weight: w.weightKg })),
      sleep: parseFloat(sleepHours.toFixed(1)),
      heartRate: vitals.find(v => v.type === 'heart_rate')?.value1 || 72,
      steps: steps?.count || 0
    };

    setStats(currentStats);

    // Generate AI Insight
    setIsInsightLoading(true);
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
    setIsInsightLoading(false);
  };

  const healthScore = 88;
  const cardBg = theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800/50' : 'bg-white border-zinc-200';
  const textMuted = theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400';

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="p-4 space-y-6 pb-32 max-w-2xl mx-auto"
    >
      <header className="flex justify-between items-end px-2">
        <div>
          <motion.p 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`${textMuted} text-xs font-bold uppercase tracking-[0.2em] mb-1`}
          >
            {format(new Date(), 'EEEE, d MMMM', { locale: undefined })}
          </motion.p>
          <h1 className="text-3xl font-bold tracking-tight">สวัสดี, {user?.name?.split(' ')[0] || 'คุณ'}</h1>
        </div>
        <motion.div 
          whileHover={{ scale: 1.05, rotate: 5 }}
          className="relative group cursor-pointer flex items-center gap-3"
          onClick={() => {
            haptics.light();
            setActiveTab('profile');
          }}
        >
          <div className="flex flex-col items-end">
            {firebaseUser ? (
              <div className="flex items-center gap-1 text-[10px] font-bold text-green-500 uppercase tracking-wider">
                <Cloud size={10} />
                <span>Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <CloudOff size={10} />
                <span>Local</span>
              </div>
            )}
            <div className="relative">
              <div className="absolute inset-0 bg-green-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className={`w-14 h-14 rounded-[1.5rem] border-2 border-green-500/20 flex items-center justify-center font-bold text-xl glass relative overflow-hidden`}>
                <span className="text-green-500">{healthScore}</span>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500" style={{ width: `${healthScore}%` }} />
              </div>
            </div>
          </div>
        </motion.div>
      </header>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-6 grid-rows-7 gap-4 h-[800px]">
        
        {/* Steps - New Bento */}
        <motion.div 
          variants={item}
          whileHover={{ y: -5 }}
          onClick={() => {
            haptics.light();
            setActiveTab('metrics');
          }}
          className={`col-span-6 row-span-1 ${cardBg} bento-card p-4 flex items-center justify-between cursor-pointer group overflow-hidden relative`}
        >
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center">
              <Activity size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight">{stats.steps.toLocaleString()} <span className="text-xs font-normal text-zinc-500">ก้าว</span></p>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500" style={{ width: `${Math.min((stats.steps / 10000) * 100, 100)}%` }} />
                </div>
                <span className={`text-[10px] ${textMuted}`}>เป้าหมาย 10,000</span>
              </div>
            </div>
          </div>
          {isGoogleFitConnected && (
            <div className="flex items-center gap-1.5 bg-green-500/10 text-green-500 px-3 py-1 rounded-full relative z-10">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Synced from Watch</span>
            </div>
          )}
          <Activity className="absolute -right-4 -bottom-4 text-orange-500/5 w-24 h-24 rotate-12 group-hover:scale-110 transition-transform" />
        </motion.div>

        {/* Calories - Large Bento */}
        <motion.div 
          variants={item}
          whileHover={{ y: -5 }}
          onClick={() => {
            haptics.light();
            setActiveTab('nutrition');
          }}
          className={`col-span-4 row-span-3 ${cardBg} bento-card p-6 flex flex-col justify-between cursor-pointer relative overflow-hidden group`}
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Flame size={120} className="text-nutrition" />
          </div>
          <div className="flex justify-between items-start relative z-10">
            <div className="w-12 h-12 bg-nutrition/10 text-nutrition rounded-2xl flex items-center justify-center">
              <Flame size={24} />
            </div>
            <div className="text-right">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>พลังงานวันนี้</p>
              <p className="text-xs font-medium text-nutrition">เป้าหมาย {user?.dailyCalorieTarget || 2200}</p>
            </div>
          </div>
          <div className="relative z-10">
            <div className="flex items-baseline gap-2">
              <h2 className="text-5xl font-bold tracking-tighter">{stats.calories}</h2>
              <span className={`${textMuted} font-medium`}>kcal</span>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className={textMuted}>ความคืบหน้า</span>
                <span className="text-nutrition">{Math.round((stats.calories / (user?.dailyCalorieTarget || 2200)) * 100)}%</span>
              </div>
              <div className="h-2 bg-zinc-800/50 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((stats.calories / (user?.dailyCalorieTarget || 2200)) * 100, 100)}%` }}
                  className="h-full bg-gradient-to-r from-nutrition to-orange-400 rounded-full"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Water - Vertical Bento */}
        <motion.div 
          variants={item}
          whileHover={{ y: -5 }}
          onClick={() => {
            haptics.light();
            setActiveTab('nutrition');
          }}
          className={`col-span-2 row-span-4 ${cardBg} bento-card p-6 flex flex-col justify-between cursor-pointer group`}
        >
          <div className="w-12 h-12 bg-water/10 text-water rounded-2xl flex items-center justify-center">
            <Droplets size={24} />
          </div>
          <div className="flex-1 flex flex-col justify-center items-center py-4">
            <div className="relative w-24 h-32 bg-zinc-800/30 rounded-2xl border border-white/5 overflow-hidden">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${Math.min((stats.water / 2500) * 100, 100)}%` }}
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-water to-blue-400"
              >
                <div className="absolute top-0 left-0 right-0 h-4 bg-white/20 animate-pulse" />
              </motion.div>
            </div>
            <h2 className="text-2xl font-bold mt-4">{stats.water}</h2>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>มล.</p>
          </div>
          <p className="text-[10px] text-center font-medium text-water">เป้าหมาย 2.5L</p>
        </motion.div>

        {/* Heart Rate - Small Bento */}
        <motion.div 
          variants={item}
          whileHover={{ y: -5 }}
          onClick={() => {
            haptics.light();
            setActiveTab('metrics');
          }}
          className={`col-span-2 row-span-2 ${cardBg} bento-card p-5 flex flex-col justify-between cursor-pointer`}
        >
          <div className="flex justify-between items-center">
            <div className="w-10 h-10 bg-activity/10 text-activity rounded-xl flex items-center justify-center">
              <Heart size={20} className="animate-pulse" />
            </div>
            <Wind size={16} className={textMuted} />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.heartRate}</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>BPM</p>
          </div>
        </motion.div>

        {/* Sleep - Small Bento */}
        <motion.div 
          variants={item}
          whileHover={{ y: -5 }}
          onClick={() => {
            haptics.light();
            setActiveTab('sleep');
          }}
          className={`col-span-2 row-span-2 ${cardBg} bento-card p-5 flex flex-col justify-between cursor-pointer`}
        >
          <div className="flex justify-between items-center">
            <div className="w-10 h-10 bg-sleep/10 text-sleep rounded-xl flex items-center justify-center">
              <Moon size={20} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.sleep || '--'}</p>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>ชั่วโมง</p>
          </div>
        </motion.div>

        {/* Weight Trend - Wide Bento */}
        <motion.div 
          variants={item}
          whileHover={{ y: -5 }}
          onClick={() => {
            haptics.light();
            setActiveTab('metrics');
          }}
          className={`col-span-4 row-span-2 ${cardBg} bento-card p-6 flex flex-col justify-between cursor-pointer relative overflow-hidden`}
        >
          <div className="flex justify-between items-center relative z-10">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>น้ำหนัก</p>
              <h3 className="text-2xl font-bold">{stats.weight} <span className="text-xs font-normal text-zinc-500">กก.</span></h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-body uppercase tracking-widest">เป้าหมาย {user?.targetWeight} กก.</p>
              <p className="text-xs font-medium text-zinc-500">เหลืออีก {(stats.weight - (user?.targetWeight || 0)).toFixed(1)} กก.</p>
            </div>
          </div>
          <div className="h-16 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.weightHistory}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorWeight)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Fasting - Small Bento */}
        <motion.div 
          variants={item}
          whileHover={{ y: -5 }}
          onClick={() => {
            haptics.light();
            setActiveTab('fasting');
          }}
          className={`col-span-2 row-span-1 ${cardBg} bento-card p-4 flex items-center gap-3 cursor-pointer`}
        >
          <div className="w-8 h-8 bg-fasting/10 text-fasting rounded-lg flex items-center justify-center">
            <Timer size={16} />
          </div>
          <div>
            <p className="text-sm font-bold">14:10</p>
            <p className={`text-[8px] font-bold uppercase tracking-widest ${textMuted}`}>Fasting</p>
          </div>
        </motion.div>

      </div>

      {/* AI Insight Banner */}
      <motion.div 
        variants={item}
        whileHover={{ scale: 1.02 }}
        className="relative group cursor-pointer"
        onClick={() => {
          haptics.light();
          setActiveTab('coach');
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-[2.5rem] flex gap-5 items-center shadow-xl shadow-green-500/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Bot size={80} className="text-white" />
          </div>
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/20">
            <Zap size={28} className="text-white animate-pulse" />
          </div>
          <div className="space-y-1 relative z-10">
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.2em]">Daily Insight</p>
            <p className="text-white font-bold text-base leading-tight">
              {isInsightLoading ? "กำลังวิเคราะห์ข้อมูลของคุณ..." : (insight || "ลองดื่มน้ำเพิ่มขึ้นอีกนิดในวันนี้ เพื่อช่วยให้ร่างกายสดชื่นและเผาผลาญได้ดีขึ้นครับ")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions Grid */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="font-bold text-lg tracking-tight">ทางลัดด่วน</h3>
          <button className={`text-xs font-bold ${textMuted} hover:text-white transition-colors`}>ดูทั้งหมด</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'บันทึกอาหาร', icon: Activity, color: 'text-nutrition', bg: 'bg-nutrition/10', tab: 'nutrition' },
            { label: 'ออกกำลังกาย', icon: Flame, color: 'text-activity', bg: 'bg-activity/10', tab: 'workout' },
          ].map((action, i) => (
            <motion.button 
              key={i}
              variants={item}
              whileHover={{ y: -5, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                haptics.light();
                setActiveTab(action.tab as any);
              }}
              className={`${cardBg} p-5 rounded-[2rem] border flex items-center gap-4 transition-all shadow-sm group`}
            >
              <div className={`w-12 h-12 ${action.bg} ${action.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <action.icon size={24} />
              </div>
              <span className="font-bold text-sm">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
