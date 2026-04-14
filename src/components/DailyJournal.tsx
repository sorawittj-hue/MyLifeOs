import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Coffee, Wine, Brain, Smartphone, Save, CheckCircle2 } from 'lucide-react';
import { db, type Habit, type HabitCompletion, withSyncMeta } from '../lib/db';
import { useAppStore } from '../lib/store';
import { firebaseService } from '../lib/firebaseService';
import { haptics } from '../lib/haptics';
import { format } from 'date-fns';

const BEHAVIORS = [
  { id: 'caffeine', name: 'Caffeine Intake', icon: Coffee, color: '#f59e0b', type: 'toggle' },
  { id: 'alcohol', name: 'Alcohol', icon: Wine, color: '#ef4444', type: 'toggle' },
  { id: 'screen_time', name: 'Screen Time Pre-bed', icon: Smartphone, color: '#3b82f6', type: 'toggle' },
  { id: 'stress', name: 'Stress Level', icon: Brain, color: '#a78bfa', type: 'slider', max: 10 },
];

export default function DailyJournal() {
  const { theme, firebaseUser } = useAppStore();
  const isDark = theme === 'dark';
  const today = format(new Date(), 'yyyy-MM-dd');

  const [behaviors, setBehaviors] = useState<Record<string, any>>({
    caffeine: false,
    alcohol: false,
    screen_time: false,
    stress: 5,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load today's logs initially
    const loadLogs = async () => {
      const habits = await db.habits.toArray();
      const completions = await db.habitCompletions.where('date').equals(today).toArray();
      
      const newBehaviors = { stress: 5 };
      BEHAVIORS.forEach(b => {
        if (b.type === 'toggle') {
          const habit = habits.find(h => h.name === b.name);
          if (habit) {
            newBehaviors[b.id] = completions.some(c => c.habitId === habit.id);
          } else {
            newBehaviors[b.id] = false;
          }
        }
      });
      setBehaviors(prev => ({ ...prev, ...newBehaviors }));
    };
    loadLogs();
  }, [today]);

  const handleToggle = (id: string) => {
    haptics.light();
    setBehaviors(prev => ({ ...prev, [id]: !prev[id] }));
    setSaved(false);
  };

  const handleSlider = (id: string, value: number) => {
    setBehaviors(prev => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  const saveJournal = async () => {
    setIsSaving(true);
    haptics.medium();
    
    try {
      const allHabits = await db.habits.toArray();
      const uid = firebaseUser?.uid;

      for (const b of BEHAVIORS) {
        if (b.type === 'toggle') {
          // Find or create habit
          let habit = allHabits.find(h => h.name === b.name);
          if (!habit) {
            const newHabit = withSyncMeta({
              name: b.name, frequency: 'daily' as const, color: b.color, icon: 'activity', createdAt: Date.now()
            });
            const id = await db.habits.add(newHabit as Habit);
            habit = { ...newHabit, id: id as number };
            if (uid) await firebaseService.batchAdd('habits', [habit], uid);
          }

          // Update completion
          const isDone = behaviors[b.id];
          const exist = await db.habitCompletions.where({ habitId: habit.id, date: today }).first();
          
          if (isDone && !exist && habit.id) {
            const comp = withSyncMeta({ habitId: habit.id, date: today });
            const cid = await db.habitCompletions.add(comp);
            if (uid) await firebaseService.batchAdd('habitCompletions', [{ ...comp, id: cid as number }], uid);
          } else if (!isDone && exist && exist.id) {
            await db.habitCompletions.delete(exist.id);
            if (uid && exist._firebaseId) {
              // Deletion from firestore logic would go here
            }
          }
        } else if (b.type === 'slider') {
          // Log stress as a generic vital if needed, or modify state
          const vitalLog = withSyncMeta({
             date: today, time: format(new Date(), 'HH:mm'), type: 'blood_pressure', // reusing or mock type
             value1: behaviors[b.id], unit: 'stress_level', notes: 'stress_slider'
          });
          // await db.vitals.add(vitalLog as any);
        }
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
    
    setIsSaving(false);
  };

  const cardBg = isDark ? 'glass-card' : 'bg-white shadow-sm border border-zinc-200';

  return (
    <div className="p-4 space-y-6 max-w-lg mx-auto">
      <header className="mb-4">
        <h2 className="text-2xl font-black tracking-tight mb-1">Journal</h2>
        <p className={`text-xs font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Log today's behaviors for better AI correlations
        </p>
      </header>

      <div className="space-y-3">
        {BEHAVIORS.map(behavior => {
          const Icon = behavior.icon;
          const isActive = behaviors[behavior.id];
          const isSlider = behavior.type === 'slider';

          return (
            <motion.div
              key={behavior.id}
              whileTap={{ scale: isSlider ? 1 : 0.98 }}
              className={`p-4 rounded-[24px] flex flex-col justify-center transition-all ${cardBg} ${
                !isSlider && isActive && isDark ? 'bg-white/[0.08] border-white/10' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 w-full">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center`} style={{ backgroundColor: `${behavior.color}20`, color: behavior.color }}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold text-sm tracking-tight ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                      {behavior.name}
                    </p>
                    {isSlider && (
                       <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'} mt-0.5`}>
                         Level {behaviors[behavior.id]}
                       </p>
                    )}
                  </div>
                  {!isSlider && (
                    <button
                      onClick={() => handleToggle(behavior.id)}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                        isActive ? 'bg-green-500' : isDark ? 'bg-zinc-800' : 'bg-zinc-200'
                      }`}
                    >
                      <motion.div
                        initial={false}
                        animate={{ x: isActive ? 24 : 2 }}
                        className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  )}
                </div>
              </div>

              {isSlider && (
                <div className="mt-4 px-2 w-full">
                  <input
                    type="range"
                    min="1"
                    max={behavior.max}
                    value={behaviors[behavior.id]}
                    onChange={(e) => handleSlider(behavior.id, parseInt(e.target.value))}
                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    style={{ WebkitAppearance: 'none' }}
                  />
                  <div className="flex justify-between mt-2 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={saveJournal}
        disabled={isSaving}
        className={`w-full py-4 rounded-[20px] font-black tracking-widest uppercase text-xs flex items-center justify-center gap-2 transition-all ${
          saved
            ? 'bg-green-500 text-white'
            : isDark
            ? 'bg-white text-black hover:bg-zinc-200'
            : 'bg-black text-white hover:bg-zinc-800'
        }`}
      >
        {isSaving ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : saved ? (
          <><CheckCircle2 size={16} /> Saved</>
        ) : (
          <><Save size={16} /> Save Journal</>
        )}
      </motion.button>
    </div>
  );
}
