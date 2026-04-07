import React, { useState, useEffect } from 'react';
import { Plus, Dumbbell, Clock, ChevronRight, Play, History, Search, X } from 'lucide-react';
import { db, type Workout, type WorkoutSet } from '../lib/db';
import { format, differenceInMinutes } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../lib/store';
import { firebaseService } from '../lib/firebaseService';

export default function WorkoutTracker() {
  const { theme, firebaseUser } = useAppStore();
  const isDark = theme === 'dark';
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [showAddWorkout, setShowAddWorkout] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let unsubscribe: () => void;

    if (firebaseUser) {
      unsubscribe = firebaseService.subscribeToCollection('workouts', firebaseUser.uid, (data) => {
        const sorted = (data as Workout[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setWorkouts(sorted);
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
      startedAt: Date.now(),
    };

    if (firebaseUser) {
      await firebaseService.addToCollection('workouts', workout);
    } else {
      const id = await db.workouts.add(workout as Workout);
      setActiveWorkout({ ...workout, id });
    }
    setShowAddWorkout(false);
  };

  const finishWorkout = async () => {
    if (activeWorkout?.id) {
      const duration = Math.round((Date.now() - ((activeWorkout as any).startedAt || Date.now())) / 60000);
      if (firebaseUser) {
        await firebaseService.updateInCollection('workouts', activeWorkout.id.toString(), {
          duration,
        });
      } else {
        await db.workouts.update(activeWorkout.id as number, { duration });
        loadWorkouts();
      }
      setActiveWorkout(null);
    }
  };

  // Fix #18: Exercise library with real data and search
  const exerciseLibrary = [
    { name: 'Bench Press', category: 'อก', muscles: 'หน้าอก, ไหล่หน้า, ไตรเซ็ป' },
    { name: 'Squat', category: 'ขา', muscles: 'ต้นขาหน้า, ก้น, แกนกลาง' },
    { name: 'Deadlift', category: 'หลัง', muscles: 'หลังล่าง, ต้นขาหลัง, ก้น' },
    { name: 'Overhead Press', category: 'ไหล่', muscles: 'ไหล่, ไตรเซ็ป' },
    { name: 'Barbell Row', category: 'หลัง', muscles: 'หลังบน, ไบเซ็ป' },
    { name: 'Pull Up', category: 'หลัง', muscles: 'หลังบน, ไบเซ็ป, แขน' },
    { name: 'Dumbbell Curl', category: 'แขน', muscles: 'ไบเซ็ป' },
    { name: 'Tricep Dip', category: 'แขน', muscles: 'ไตรเซ็ป, หน้าอก' },
    { name: 'Leg Press', category: 'ขา', muscles: 'ต้นขาหน้า, ก้น' },
    { name: 'Plank', category: 'แกน', muscles: 'แกนกลาง, หลังล่าง' },
  ];

  const filteredExercises = exerciseLibrary.filter(ex =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.category.includes(searchQuery) ||
    ex.muscles.includes(searchQuery)
  );

  const cardBg = isDark ? 'glass-card' : 'glass-card-light';
  const textMuted = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const inputBg = isDark ? 'input-premium text-white' : 'input-premium-light text-zinc-900';

  return (
    <div className="p-5 space-y-5 pb-28">
      <header className="flex justify-between items-center">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${textMuted} mb-0.5`}>Workout</p>
          <h1 className="text-2xl font-bold tracking-tight">การออกกำลังกาย</h1>
        </div>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAddWorkout(true)}
          className="bg-green-500 text-black p-2.5 rounded-xl shadow-lg shadow-green-500/20 hover:shadow-green-500/30 transition-shadow"
        >
          <Plus size={22} />
        </motion.button>
      </header>

      {/* Active Workout Banner - Fix #14: ปุ่ม "ทำต่อ" ทำงานจริง */}
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
              onClick={finishWorkout}
              className="bg-black text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg"
            >
              จบการออกกำลังกาย
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
              className={`${cardBg} p-4 bento-card flex justify-between items-center group`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 ${isDark ? p.color + '/10' : p.color.replace('bg-', 'bg-') + '/10'} ${p.color.replace('bg-', 'text-')} rounded-xl flex items-center justify-center`}>
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

      {/* Recent History - Fix #4: Use real duration */}
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
                className={`${cardBg} p-3.5 bento-card flex justify-between items-center`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'} ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    <Dumbbell size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{w.name}</p>
                    <p className={`text-[10px] ${textMuted}`}>{format(new Date(w.date), 'd MMM yyyy')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{w.duration || '--'} <span className={`text-xs font-normal ${textMuted}`}>นาที</span></p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {workouts.length === 0 && (
            <div className={`text-center py-12 rounded-[1.75rem] border border-dashed ${isDark ? 'text-zinc-600 bg-white/[0.02] border-white/[0.06]' : 'text-zinc-400 bg-black/[0.02] border-black/[0.06]'}`}>
              ยังไม่มีประวัติการออกกำลังกาย
            </div>
          )}
        </div>
      </section>

      {/* Exercise Library - Fix #18: Search with real filtering */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBg} p-5 bento-card space-y-4`}
      >
        <div className="flex justify-between items-center">
          <h3 className="font-bold">คลังท่าออกกำลังกาย</h3>
          <span className={`text-xs ${textMuted}`}>{exerciseLibrary.length} ท่า</span>
        </div>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} size={16} />
          <input 
            type="text" 
            placeholder="ค้นหาท่าออกกำลังกาย..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full rounded-xl py-3 pl-10 pr-4 text-sm ${inputBg}`}
          />
        </div>
        {searchQuery && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {filteredExercises.map((ex, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => { startWorkout(ex.name); setSearchQuery(''); }}
                className={`w-full text-left p-3 rounded-xl transition-colors ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-black/[0.04]'}`}
              >
                <p className="font-bold text-sm">{ex.name}</p>
                <p className={`text-[10px] ${textMuted}`}>{ex.category} • {ex.muscles}</p>
              </motion.button>
            ))}
            {filteredExercises.length === 0 && (
              <p className={`text-center py-4 text-sm ${textMuted}`}>ไม่พบท่าออกกำลังกายที่ตรงกัน</p>
            )}
          </div>
        )}
      </motion.section>
    </div>
  );
}
