import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Circle, Plus, Flame, Trophy, Calendar, Trash2 } from 'lucide-react';
import { db, type Habit, type HabitCompletion } from '../lib/db';
import { format, subDays, eachDayOfInterval, startOfYear } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../lib/store';
import { firebaseService } from '../lib/firebaseService';

export default function HabitTracker() {
  const { theme, firebaseUser } = useAppStore();
  const isDark = theme === 'dark';
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: '', color: '#22c55e' });

  useEffect(() => {
    let unsubscribeHabits: () => void;
    let unsubscribeCompletions: () => void;

    if (firebaseUser) {
      unsubscribeHabits = firebaseService.subscribeToCollection('habits', firebaseUser.uid, (data) => {
        setHabits(data as Habit[]);
      });
      unsubscribeCompletions = firebaseService.subscribeToCollection('habitCompletions', firebaseUser.uid, (data) => {
        setCompletions(data as HabitCompletion[]);
      });
    } else {
      loadHabits();
    }

    return () => {
      unsubscribeHabits?.();
      unsubscribeCompletions?.();
    };
  }, [firebaseUser]);

  const loadHabits = async () => {
    const h = await db.habits.toArray();
    const c = await db.habitCompletions.toArray();
    setHabits(h);
    setCompletions(c);
  };

  const toggleHabit = async (habitId: string | number) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const existing = completions.find(c => c.habitId === habitId && c.date === today);

    if (firebaseUser) {
      if (existing?.id) {
        await firebaseService.deleteFromCollection('habitCompletions', existing.id.toString());
      } else {
        await firebaseService.addToCollection('habitCompletions', { habitId: habitId.toString(), date: today });
      }
    } else {
      if (existing?.id) {
        await db.habitCompletions.delete(existing.id as number);
      } else {
        await db.habitCompletions.add({ habitId: habitId as number, date: today });
      }
      loadHabits();
    }
  };

  const addHabit = async () => {
    if (!newHabit.name) return;
    const habit: any = {
      name: newHabit.name,
      frequency: 'daily',
      color: newHabit.color,
      icon: 'star',
      createdAt: Date.now()
    };

    if (firebaseUser) {
      await firebaseService.addToCollection('habits', habit);
    } else {
      await db.habits.add(habit as Habit);
      loadHabits();
    }

    setNewHabit({ name: '', color: '#22c55e' });
    setShowAdd(false);
  };

  const deleteHabit = async (id: string | number) => {
    if (firebaseUser) {
      await firebaseService.deleteFromCollection('habits', id as string);
    } else {
      await db.habits.delete(id as number);
      await db.habitCompletions.where('habitId').equals(id as number).delete();
      loadHabits();
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  // Fix #1: Calculate real streak and completed days
  const completedDates = useMemo(() => {
    const dateSet = new Set<string>();
    completions.forEach(c => dateSet.add(c.date));
    return dateSet;
  }, [completions]);

  const { maxStreak, totalCompletedDays } = useMemo(() => {
    if (completedDates.size === 0) return { maxStreak: 0, totalCompletedDays: 0 };

    const sortedDates = Array.from(completedDates).sort();
    let currentStreak = 1;
    let best = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        currentStreak++;
        best = Math.max(best, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return { maxStreak: best, totalCompletedDays: sortedDates.length };
  }, [completedDates]);

  // Fix #2: Build heatmap from real data
  const heatmapData = useMemo(() => {
    const days: { date: string; level: number }[] = [];
    const end = new Date();
    const start = subDays(end, 99);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayCompletions = completions.filter(c => c.date === dateStr).length;
      const totalHabits = habits.length || 1;
      const ratio = dayCompletions / totalHabits;
      
      let level = 0;
      if (ratio > 0.8) level = 3;
      else if (ratio > 0.4) level = 2;
      else if (ratio > 0) level = 1;
      
      days.push({ date: dateStr, level });
    }
    return days;
  }, [completions, habits]);

  const cardBg = isDark ? 'glass-card' : 'glass-card-light';
  const textMuted = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const inputBg = isDark ? 'input-premium text-white' : 'input-premium-light text-zinc-900';

  return (
    <div className="p-5 space-y-5 pb-28">
      <header className="flex justify-between items-center">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${textMuted} mb-0.5`}>Habits</p>
          <h1 className="text-2xl font-bold tracking-tight">นิสัยที่ดี</h1>
        </div>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAdd(true)}
          className="bg-green-500 text-black p-2 rounded-xl shadow-lg shadow-green-500/20"
        >
          <Plus size={24} />
        </motion.button>
      </header>

      {/* Stats Overview - Fix #1: real data */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${cardBg} p-4 bento-card space-y-1`}
        >
          <div className="flex items-center gap-2 text-orange-500">
            <Flame size={16} />
            <span className="text-[10px] font-bold uppercase">ต่อเนื่องสูงสุด</span>
          </div>
          <p className="text-2xl font-bold">{maxStreak} วัน</p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${cardBg} p-5 rounded-3xl border space-y-1 shadow-sm`}
        >
          <div className="flex items-center gap-2 text-yellow-500">
            <Trophy size={16} />
            <span className="text-[10px] font-bold uppercase">วันที่สมบูรณ์</span>
          </div>
          <p className="text-2xl font-bold">{totalCompletedDays}</p>
        </motion.div>
      </div>

      {/* Daily List */}
      <section className="space-y-4">
        <h3 className="font-bold text-lg">รายการวันนี้</h3>
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {habits.map((habit, idx) => {
              const isCompleted = completions.some(c => c.habitId === habit.id && c.date === today);
              return (
                <motion.div 
                  key={habit.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-3.5 rounded-2xl transition-all flex justify-between items-center ${
                    isCompleted 
                      ? `${isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}` 
                      : cardBg
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <motion.button 
                      whileTap={{ scale: 0.8 }}
                      onClick={() => habit.id && toggleHabit(habit.id)}
                      className={`transition-colors ${isCompleted ? 'text-green-500' : 'text-zinc-700'}`}
                    >
                      {isCompleted ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                    </motion.button>
                    <div>
                      <p className={`font-bold ${isCompleted ? 'text-green-500 line-through opacity-50' : (theme === 'dark' ? 'text-white' : 'text-zinc-900')}`}>
                        {habit.name}
                      </p>
                      <p className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>เป้าหมายรายวัน</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => habit.id && deleteHabit(habit.id)}
                    className="text-zinc-800 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {habits.length === 0 && (
            <div className={`text-center py-12 rounded-[1.75rem] border border-dashed ${isDark ? 'text-zinc-600 bg-white/[0.02] border-white/[0.06]' : 'text-zinc-400 bg-black/[0.02] border-black/[0.06]'}`}>
              ยังไม่มีนิสัยที่ติดตาม เริ่มจากสิ่งเล็กๆ กันเถอะ!
            </div>
          )}
        </div>
      </section>

      {/* Heatmap - Fix #2: real data */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBg} p-5 bento-card space-y-4`}
      >
        <div className="flex justify-between items-center">
          <h3 className="font-bold">ความคืบหน้าตลอดปี</h3>
          <Calendar size={18} className={textMuted} />
        </div>
        <div className="flex flex-wrap gap-1">
          {heatmapData.map((day, i) => (
            <div 
              key={i} 
              title={day.date}
              className={`w-2.5 h-2.5 rounded-sm ${
                day.level === 3 ? 'bg-green-500' : 
                day.level === 2 ? 'bg-green-700' : 
                day.level === 1 ? 'bg-green-900' : 
                (isDark ? 'bg-zinc-800' : 'bg-zinc-100')
              }`} 
            />
          ))}
        </div>
        <p className={`text-[10px] text-center uppercase font-bold tracking-widest ${textMuted}`}>ความสม่ำเสมอคือหัวใจสำคัญ</p>
      </motion.section>

      {/* Add Habit Modal - Fix #6: backdrop close */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 modal-backdrop z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAdd(false)}>
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-5 ${isDark ? 'bg-[#141414] border border-white/[0.06]' : 'bg-white border border-black/[0.06] shadow-2xl'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">สร้างนิสัยใหม่</h2>
                <button onClick={() => setShowAdd(false)} className={textMuted}>ปิด</button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className={`text-xs font-bold uppercase ${textMuted}`}>ชื่อนิสัย</label>
                  <input 
                    type="text" 
                    value={newHabit.name}
                    onChange={e => setNewHabit({ ...newHabit, name: e.target.value })}
                    className={`w-full ${inputBg} rounded-xl p-4 outline-none focus:ring-2 focus:ring-green-500`}
                    placeholder="เช่น ดื่มน้ำ 2 ลิตร"
                  />
                </div>
                <div className="space-y-1">
                  <label className={`text-xs font-bold uppercase ${textMuted}`}>สี</label>
                  <div className="flex gap-3">
                    {['#22c55e', '#3b82f6', '#ef4444', '#eab308', '#a855f7'].map(c => (
                      <motion.button 
                        key={c}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setNewHabit({ ...newHabit, color: c })}
                        className={`w-10 h-10 rounded-full border-2 ${newHabit.color === c ? (isDark ? 'border-white' : 'border-zinc-400') : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={addHabit}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold py-4 rounded-2xl shadow-lg shadow-green-500/20"
              >
                สร้างรายการ
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
