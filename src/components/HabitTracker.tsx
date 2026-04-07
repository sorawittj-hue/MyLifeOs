import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Plus, Flame, Trophy, Calendar, Trash2 } from 'lucide-react';
import { db, type Habit, type HabitCompletion } from '../lib/db';
import { format, startOfYear, eachDayOfInterval, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../lib/store';
import { firebaseService } from '../lib/firebaseService';

export default function HabitTracker() {
  const { theme, firebaseUser } = useAppStore();
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
      // completions will be cleaned up by rules or we can manually delete them
      // but firestore doesn't have cascade delete. For now just delete the habit.
    } else {
      await db.habits.delete(id as number);
      await db.habitCompletions.where('habitId').equals(id as number).delete();
      loadHabits();
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  const cardBg = theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200';
  const textMuted = theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400';
  const inputBg = theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100';

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">นิสัยที่ดี</h1>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAdd(true)}
          className="bg-green-500 text-black p-2 rounded-xl shadow-lg shadow-green-500/20"
        >
          <Plus size={24} />
        </motion.button>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${cardBg} p-5 rounded-3xl border space-y-1 shadow-sm`}
        >
          <div className="flex items-center gap-2 text-orange-500">
            <Flame size={16} />
            <span className="text-[10px] font-bold uppercase">ต่อเนื่องสูงสุด</span>
          </div>
          <p className="text-2xl font-bold">12 วัน</p>
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
          <p className="text-2xl font-bold">8</p>
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
                  className={`p-4 rounded-2xl border transition-all flex justify-between items-center shadow-sm ${
                    isCompleted 
                      ? 'bg-green-500/10 border-green-500/20' 
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
            <div className={`text-center py-12 rounded-3xl border border-dashed ${theme === 'dark' ? 'text-zinc-600 bg-zinc-900/50 border-zinc-800' : 'text-zinc-400 bg-zinc-50 border-zinc-200'}`}>
              ยังไม่มีนิสัยที่ติดตาม เริ่มจากสิ่งเล็กๆ กันเถอะ!
            </div>
          )}
        </div>
      </section>

      {/* Heatmap Placeholder */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBg} p-6 rounded-3xl border space-y-4 shadow-sm`}
      >
        <div className="flex justify-between items-center">
          <h3 className="font-bold">ความคืบหน้าตลอดปี</h3>
          <Calendar size={18} className={textMuted} />
        </div>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 100 }).map((_, i) => (
            <div 
              key={i} 
              className={`w-2.5 h-2.5 rounded-sm ${
                Math.random() > 0.7 ? 'bg-green-500' : Math.random() > 0.4 ? 'bg-green-900' : (theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100')
              }`} 
            />
          ))}
        </div>
        <p className={`text-[10px] text-center uppercase font-bold tracking-widest ${textMuted}`}>ความสม่ำเสมอคือหัวใจสำคัญ</p>
      </motion.section>

      {/* Add Habit Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl border p-6 space-y-6 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}
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
                    className={`w-full border-none rounded-xl p-4 outline-none focus:ring-2 focus:ring-green-500 ${inputBg} ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}
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
                        className={`w-10 h-10 rounded-full border-2 ${newHabit.color === c ? (theme === 'dark' ? 'border-white' : 'border-zinc-400') : 'border-transparent'}`}
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
                className="w-full bg-green-500 text-black font-bold py-4 rounded-2xl shadow-lg shadow-green-500/20"
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
