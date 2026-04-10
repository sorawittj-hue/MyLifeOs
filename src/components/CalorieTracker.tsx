import React, { useState, useEffect } from 'react';
import { Plus, Droplets, Trash2, Utensils, Apple, Coffee, Salad, Cookie, X } from 'lucide-react';
import { db, type FoodLog, type WaterLog, withSyncMeta } from '../lib/db';
import { haptics } from '../lib/haptics';
import { format } from 'date-fns';
import { useAppStore } from '../lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { firebaseService } from '../lib/firebaseService';

const mealIcons: Record<string, any> = {
  breakfast: Coffee,
  lunch: Salad,
  dinner: Utensils,
  snack: Cookie
};

export default function CalorieTracker() {
  const { user, theme, firebaseUser } = useAppStore();
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [showAddFood, setShowAddFood] = useState(false);
  const [newFood, setNewFood] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    mealType: 'breakfast' as any
  });
  const isDark = theme === 'dark';

  useEffect(() => {
    let unsubscribeFood: () => void;
    let unsubscribeWater: () => void;

    if (firebaseUser) {
      unsubscribeFood = firebaseService.subscribeToCollection<FoodLog>('foodLogs', firebaseUser.uid, (data) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        setFoodLogs(data.filter(d => d.date === today));
      });
      unsubscribeWater = firebaseService.subscribeToCollection<WaterLog>('waterLogs', firebaseUser.uid, (data) => {
        const today = format(new Date(), 'yyyy-MM-dd');
        setWaterLogs(data.filter(d => d.date === today));
      });
    } else {
      loadLogs();
    }

    return () => {
      unsubscribeFood?.();
      unsubscribeWater?.();
    };
  }, [firebaseUser]);

  const loadLogs = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const foods = await db.foodLogs.where('date').equals(today).toArray();
    const water = await db.waterLogs.where('date').equals(today).toArray();
    setFoodLogs(foods);
    setWaterLogs(water);
  };

  const addFood = async () => {
    if (!newFood.name || !newFood.calories) return;
    const cal = parseInt(newFood.calories);
    if (isNaN(cal) || cal < 1 || cal > 9999) return;
    const protein = Math.max(0, Math.min(999, parseInt(newFood.protein) || 0));
    const carbs = Math.max(0, Math.min(999, parseInt(newFood.carbs) || 0));
    const fat = Math.max(0, Math.min(999, parseInt(newFood.fat) || 0));
    haptics.success();
    const today = format(new Date(), 'yyyy-MM-dd');
    const log: any = {
      date: today,
      name: newFood.name,
      calories: cal,
      protein,
      carbs,
      fat,
      mealType: newFood.mealType,
      quantity: 1,
      timestamp: Date.now()
    };

    if (firebaseUser) {
      await firebaseService.addToCollection('foodLogs', log);
    } else {
      await db.foodLogs.add(log as FoodLog);
      loadLogs();
    }

    setNewFood({ name: '', calories: '', protein: '', carbs: '', fat: '', mealType: 'breakfast' });
    setShowAddFood(false);
  };

  const addWater = async (amount: number) => {
    haptics.medium();
    const today = format(new Date(), 'yyyy-MM-dd');
    const log = { date: today, amountMl: amount, timestamp: Date.now() };

    if (firebaseUser) {
      await firebaseService.addToCollection('waterLogs', log);
    } else {
      await db.waterLogs.add(withSyncMeta(log) as WaterLog);
      loadLogs();
    }
  };

  const deleteFood = async (id: any) => {
    haptics.light();
    if (firebaseUser && typeof id === 'string') {
      await firebaseService.deleteFromCollection('foodLogs', id);
    } else {
      await db.foodLogs.delete(id);
      loadLogs();
    }
  };

  const totals = foodLogs.reduce((acc, log) => ({
    calories: acc.calories + log.calories,
    protein: acc.protein + log.protein,
    carbs: acc.carbs + log.carbs,
    fat: acc.fat + log.fat
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const waterTotal = waterLogs.reduce((acc, log) => acc + log.amountMl, 0);
  const calorieTarget = user?.dailyCalorieTarget || 2000;

  const mealTypeLabels: Record<string, string> = {
    breakfast: 'อาหารเช้า',
    lunch: 'อาหารกลางวัน',
    dinner: 'อาหารเย็น',
    snack: 'ของว่าง'
  };

  const cardBg = isDark ? 'glass-card' : 'glass-card-light';
  const textMuted = isDark ? 'text-zinc-500' : 'text-zinc-400';

  const macros = [
    { label: 'โปรตีน', value: totals.protein, target: 150, color: isDark ? '#60a5fa' : '#3b82f6', bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50' },
    { label: 'คาร์บ', value: totals.carbs, target: 250, color: isDark ? '#fbbf24' : '#eab308', bg: isDark ? 'bg-yellow-500/10' : 'bg-yellow-50' },
    { label: 'ไขมัน', value: totals.fat, target: 65, color: isDark ? '#f87171' : '#ef4444', bg: isDark ? 'bg-red-500/10' : 'bg-red-50' },
  ];

  return (
    <div className="p-5 space-y-5 pb-28">
      <header className="flex justify-between items-center">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${textMuted} mb-0.5`}>Nutrition</p>
          <h1 className="text-2xl font-bold tracking-tight">อาหารและโภชนาการ</h1>
        </div>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            haptics.light();
            setShowAddFood(true);
          }}
          className="bg-green-500 text-black p-2.5 rounded-xl shadow-lg shadow-green-500/20 hover:shadow-green-500/30 transition-shadow"
        >
          <Plus size={22} />
        </motion.button>
      </header>

      {/* Summary Card */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`${cardBg} bento-card p-5 space-y-5`}
      >
        <div className="flex justify-between items-end">
          <div className="space-y-0.5">
            <p className={`${textMuted} text-[10px] font-semibold uppercase tracking-wider`}>แคลอรี่ที่เหลือ</p>
            <h2 className={`text-4xl font-bold tracking-tight ${(calorieTarget - totals.calories) < 0 ? 'text-red-400' : ''}`}>
              {calorieTarget - totals.calories}
            </h2>
          </div>
          <div className="text-right">
            <p className={`${textMuted} text-[10px] font-semibold uppercase tracking-wider`}>ทานไปแล้ว</p>
            <p className={`text-xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
              {totals.calories} <span className={`text-xs ${textMuted} font-normal`}>/ {calorieTarget}</span>
            </p>
          </div>
        </div>

        <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`}>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((totals.calories / calorieTarget) * 100, 100)}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className={`h-full rounded-full ${(totals.calories / calorieTarget) > 1 ? 'bg-gradient-to-r from-red-500 to-red-400' : 'bg-gradient-to-r from-green-500 to-emerald-400'}`}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {macros.map((m, i) => (
            <div key={i} className={`p-3 rounded-xl ${isDark ? 'bg-white/[0.03]' : 'bg-black/[0.02]'} space-y-1.5`}>
              <p className={`text-[9px] ${textMuted} font-semibold uppercase tracking-wider`}>{m.label}</p>
              <p className="font-bold text-sm">{m.value}<span className={`text-[10px] ${textMuted} font-normal`}>ก.</span></p>
              <div className={`h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((m.value / m.target) * 100, 100)}%` }}
                  transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: m.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Water Tracker */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`${cardBg} bento-card p-5 space-y-3`}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'} text-blue-500`}>
              <Droplets size={16} />
            </div>
            <h3 className="font-bold text-sm">น้ำดื่ม</h3>
          </div>
          <p className="font-bold text-sm">{waterTotal} <span className={`text-xs ${textMuted} font-normal`}>/ 2500มล.</span></p>
        </div>
        <div className="flex gap-2">
          {[150, 250, 500].map((amount) => (
            <motion.button
              key={amount}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                haptics.light();
                addWater(amount);
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold transition-all flex-1 ${
                isDark 
                  ? 'bg-white/[0.04] border border-white/[0.06] text-zinc-300 hover:bg-white/[0.07]' 
                  : 'bg-black/[0.03] border border-black/[0.04] text-zinc-600 hover:bg-black/[0.05]'
              }`}
            >
              +{amount}มล.
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Food Logs */}
      <section className="space-y-4">
        <h3 className="font-bold text-base px-1">มื้ออาหารวันนี้</h3>
        <div className="space-y-4">
          {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => {
            const logs = foodLogs.filter(l => l.mealType === type);
            const MealIcon = mealIcons[type] || Utensils;
            return (
              <div key={type} className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-2">
                    <MealIcon size={12} className={textMuted} />
                    <h4 className={`text-[10px] font-semibold uppercase tracking-widest ${textMuted}`}>{mealTypeLabels[type]}</h4>
                  </div>
                  <span className="text-xs font-bold">{logs.reduce((s, l) => s + l.calories, 0)} kcal</span>
                </div>
                <AnimatePresence>
                  {logs.map((log) => (
                    <motion.div 
                      key={log.id} 
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className={`${cardBg} bento-card p-3.5 flex justify-between items-center group`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'}`}>
                          <Utensils size={16} className={textMuted} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{log.name}</p>
                          <p className={`text-[10px] ${textMuted}`}>P: {log.protein}ก. • C: {log.carbs}ก. • F: {log.fat}ก.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-sm">{log.calories} <span className={`text-[9px] ${textMuted} font-normal`}>kcal</span></p>
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => log.id && deleteFood(log.id)}
                          className={`${isDark ? 'text-zinc-700 hover:text-red-400' : 'text-zinc-300 hover:text-red-500'} transition-colors`}
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {logs.length === 0 && (
                  <motion.button 
                    whileHover={{ scale: 1.005, y: -1 }}
                    whileTap={{ scale: 0.995 }}
                    onClick={() => {
                      setNewFood(prev => ({ ...prev, mealType: type as any }));
                      setShowAddFood(true);
                    }}
                    className={`w-full py-3 border border-dashed rounded-2xl text-xs font-medium transition-all ${
                      isDark 
                        ? 'border-white/[0.06] text-zinc-600 hover:text-zinc-400 hover:border-white/[0.1]' 
                        : 'border-black/[0.08] text-zinc-400 hover:text-zinc-600 hover:border-black/[0.15]'
                    }`}
                  >
                    เพิ่ม {mealTypeLabels[type]}
                  </motion.button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Add Food Modal */}
      <AnimatePresence>
        {showAddFood && (
          <div className="fixed inset-0 modal-backdrop z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAddFood(false)}>
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 200 }}
              className={`w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-5 ${isDark ? 'bg-[#141414] border border-white/[0.06]' : 'bg-white border border-black/[0.06] shadow-2xl'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="flex justify-center sm:hidden">
                <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
              </div>
              
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">เพิ่มอาหาร</h2>
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowAddFood(false)} 
                  className={`p-2 rounded-xl ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-black/[0.04]'} transition-colors`}
                >
                  <X size={18} className={textMuted} />
                </motion.button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>ชื่ออาหาร</label>
                  <input 
                    type="text" 
                    value={newFood.name}
                    onChange={e => setNewFood({ ...newFood, name: e.target.value })}
                    className={`w-full ${isDark ? 'input-premium text-white' : 'input-premium-light text-zinc-900'}`}
                    placeholder="เช่น อกไก่ย่าง"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>แคลอรี่</label>
                    <input 
                      type="number" 
                      value={newFood.calories}
                      onChange={e => setNewFood({ ...newFood, calories: e.target.value })}
                      className={`w-full ${isDark ? 'input-premium text-white' : 'input-premium-light text-zinc-900'}`}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-semibold uppercase tracking-wider ${textMuted}`}>มื้ออาหาร</label>
                    <select 
                      value={newFood.mealType}
                      onChange={e => setNewFood({ ...newFood, mealType: e.target.value as any })}
                      className={`w-full ${isDark ? 'input-premium text-white' : 'input-premium-light text-zinc-900'}`}
                    >
                      <option value="breakfast">อาหารเช้า</option>
                      <option value="lunch">อาหารกลางวัน</option>
                      <option value="dinner">อาหารเย็น</option>
                      <option value="snack">ของว่าง</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className={`text-[9px] font-semibold uppercase tracking-wider ${textMuted}`}>โปรตีน (ก.)</label>
                    <input 
                      type="number" 
                      value={newFood.protein}
                      onChange={e => setNewFood({ ...newFood, protein: e.target.value })}
                      className={`w-full text-sm ${isDark ? 'input-premium text-white' : 'input-premium-light text-zinc-900'}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={`text-[9px] font-semibold uppercase tracking-wider ${textMuted}`}>คาร์บ (ก.)</label>
                    <input 
                      type="number" 
                      value={newFood.carbs}
                      onChange={e => setNewFood({ ...newFood, carbs: e.target.value })}
                      className={`w-full text-sm ${isDark ? 'input-premium text-white' : 'input-premium-light text-zinc-900'}`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={`text-[9px] font-semibold uppercase tracking-wider ${textMuted}`}>ไขมัน (ก.)</label>
                    <input 
                      type="number" 
                      value={newFood.fat}
                      onChange={e => setNewFood({ ...newFood, fat: e.target.value })}
                      className={`w-full text-sm ${isDark ? 'input-premium text-white' : 'input-premium-light text-zinc-900'}`}
                    />
                  </div>
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={addFood}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold py-4 rounded-2xl shadow-lg shadow-green-500/20 hover:shadow-green-500/30 transition-all"
              >
                บันทึกอาหาร
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
