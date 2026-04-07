import React, { useState, useEffect } from 'react';
import { Plus, Dumbbell, Clock, ChevronRight, Play, History, Search } from 'lucide-react';
import { db, type Workout, type WorkoutSet } from '../lib/db';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../lib/store';
import { firebaseService } from '../lib/firebaseService';

export default function WorkoutTracker() {
  const { theme, firebaseUser } = useAppStore();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [showAddWorkout, setShowAddWorkout] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    let unsubscribe: () => void;

    if (firebaseUser) {
      unsubscribe = firebaseService.subscribeToCollection('workouts', firebaseUser.uid, (data) => {
        const sorted = (data as Workout[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setWorkouts(sorted);
        // In this simple version, we don't have a 'completed' flag in the original db.Workout type, 
        // but let's assume we can find an active one if needed.
      });
    } else {
      loadWorkouts();
    }

    return () => unsubscribe?.();
  }, [firebaseUser]);

  const loadWorkouts = async () => {
    const data = await db.workouts.reverse().limit(10).toArray();
    setWorkouts(data);
  };

  const startWorkout = async (name: string) => {
    const workout: any = {
      date: format(new Date(), 'yyyy-MM-dd'),
      name,
      duration: 0,
    };

    if (firebaseUser) {
      await firebaseService.addToCollection('workouts', workout);
    } else {
      const id = await db.workouts.add(workout as Workout);
      setActiveWorkout({ ...workout, id });
    }
    setShowAddWorkout(false);
  };

  const cardBg = theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200';
  const textMuted = theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400';
  const inputBg = theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100';

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">การออกกำลังกาย</h1>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAddWorkout(true)}
          className="bg-green-500 text-black p-2 rounded-xl shadow-lg shadow-green-500/20"
        >
          <Plus size={24} />
        </motion.button>
      </header>

      {/* Active Workout Banner */}
      <AnimatePresence>
        {activeWorkout && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-green-500 p-5 rounded-3xl flex justify-between items-center shadow-lg shadow-green-500/20"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black/20 rounded-2xl flex items-center justify-center">
                <Dumbbell size={24} className="text-black" />
              </div>
              <div>
                <p className="text-black/60 text-[10px] font-bold uppercase tracking-wider">กำลังออกกำลังกาย</p>
                <h2 className="text-black font-bold text-lg">{activeWorkout.name}</h2>
              </div>
            </div>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-black text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg"
            >
              ทำต่อ
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Programs */}
      <section className="space-y-4">
        <h3 className="font-bold text-lg">โปรแกรมแนะนำ</h3>
        <div className="grid grid-cols-1 gap-3">
          {[
            { name: 'Push Pull Legs', desc: 'เน้นกล้ามเนื้อ • 6 วัน/สัปดาห์', color: 'bg-blue-500' },
            { name: 'Full Body 3x', desc: 'เน้นความแข็งแรง • 3 วัน/สัปดาห์', color: 'bg-purple-500' },
            { name: 'Beginner Strength', desc: 'พื้นฐาน • 3 วัน/สัปดาห์', color: 'bg-orange-500' }
          ].map((p, idx) => (
            <motion.button 
              key={p.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => startWorkout(p.name)}
              className={`${cardBg} p-5 rounded-3xl border flex justify-between items-center transition-all group shadow-sm ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${p.color}/10 ${p.color.replace('bg-', 'text-')} rounded-2xl flex items-center justify-center`}>
                  <Play size={20} fill="currentColor" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold">{p.name}</h4>
                  <p className={`text-xs ${textMuted}`}>{p.desc}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
            </motion.button>
          ))}
        </div>
      </section>

      {/* Recent History */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">ประวัติล่าสุด</h3>
          <button className="text-green-500 text-sm font-medium flex items-center">
            ประวัติทั้งหมด <History size={16} className="ml-1" />
          </button>
        </div>
        <div className="space-y-3">
          <AnimatePresence>
            {workouts.map((w, idx) => (
              <motion.div 
                key={w.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`${cardBg} p-4 rounded-2xl border flex justify-between items-center shadow-sm`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                    <Dumbbell size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{w.name}</p>
                    <p className={`text-[10px] ${textMuted}`}>{format(new Date(w.date), 'd MMM yyyy')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">45 <span className={`text-xs font-normal ${textMuted}`}>นาที</span></p>
                  <p className={`text-[10px] uppercase ${textMuted}`}>น้ำหนักรวม: 4,200 กก.</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {workouts.length === 0 && (
            <div className={`text-center py-12 rounded-3xl border border-dashed ${theme === 'dark' ? 'text-zinc-600 bg-zinc-900/50 border-zinc-800' : 'text-zinc-400 bg-zinc-50 border-zinc-200'}`}>
              ยังไม่มีประวัติการออกกำลังกาย
            </div>
          )}
        </div>
      </section>

      {/* Exercise Library Preview */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBg} p-6 rounded-3xl border space-y-4 shadow-sm`}
      >
        <div className="flex justify-between items-center">
          <h3 className="font-bold">คลังท่าออกกำลังกาย</h3>
          <span className={`text-xs ${textMuted}`}>300+ ท่า</span>
        </div>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} size={16} />
          <input 
            type="text" 
            placeholder="ค้นหาท่าออกกำลังกาย..."
            className={`w-full border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-green-500 outline-none ${inputBg} ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}
          />
        </div>
      </motion.section>
    </div>
  );
}
