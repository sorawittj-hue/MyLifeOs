import React, { useState, useEffect } from 'react';
import { Plus, Search, Barcode, Droplets, Trash2, Utensils } from 'lucide-react';
import { db, type FoodLog, type WaterLog } from '../lib/db';
import { haptics } from '../lib/haptics';
import { format } from 'date-fns';
import { useAppStore } from '../lib/store';
import { motion, AnimatePresence } from 'motion/react';
import { firebaseService } from '../lib/firebaseService';

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
    haptics.success();
    const today = format(new Date(), 'yyyy-MM-dd');
    const log: any = {
      date: today,
      name: newFood.name,
      calories: parseInt(newFood.calories),
      protein: parseInt(newFood.protein) || 0,
      carbs: parseInt(newFood.carbs) || 0,
      fat: parseInt(newFood.fat) || 0,
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
      await db.waterLogs.add(log as WaterLog);
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

  const cardBg = theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200';
  const textMuted = theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400';
  const inputBg = theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100';

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">อาหารและโภชนาการ</h1>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            haptics.light();
            setShowAddFood(true);
          }}
          className="bg-green-500 text-black p-2 rounded-xl shadow-lg shadow-green-500/20"
        >
          <Plus size={24} />
        </motion.button>
      </header>

      {/* Summary Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBg} p-6 rounded-3xl border space-y-6 shadow-sm`}
      >
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <p className={`${textMuted} text-xs font-bold uppercase tracking-wider`}>แคลอรี่ที่เหลือ</p>
            <h2 className="text-4xl font-bold">{calorieTarget - totals.calories}</h2>
          </div>
          <div className="text-right">
            <p className={`${textMuted} text-xs font-bold uppercase tracking-wider`}>ทานไปแล้ว</p>
            <p className="text-xl font-bold text-green-500">{totals.calories} <span className={`text-xs ${textMuted}`}>/ {calorieTarget}</span></p>
          </div>
        </div>

        <div className={`h-3 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((totals.calories / calorieTarget) * 100, 100)}%` }}
            className="h-full bg-green-500 transition-all duration-500" 
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className={`text-[10px] ${textMuted} font-bold uppercase`}>โปรตีน</p>
            <p className="font-bold">{totals.protein}ก.</p>
            <div className={`h-1 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
              <div className="h-full bg-blue-500" style={{ width: '40%' }} />
            </div>
          </div>
          <div className="space-y-1">
            <p className={`text-[10px] ${textMuted} font-bold uppercase`}>คาร์บ</p>
            <p className="font-bold">{totals.carbs}ก.</p>
            <div className={`h-1 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
              <div className="h-full bg-yellow-500" style={{ width: '60%' }} />
            </div>
          </div>
          <div className="space-y-1">
            <p className={`text-[10px] ${textMuted} font-bold uppercase`}>ไขมัน</p>
            <p className="font-bold">{totals.fat}ก.</p>
            <div className={`h-1 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
              <div className="h-full bg-red-500" style={{ width: '30%' }} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Water Tracker */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`${cardBg} p-5 rounded-3xl border space-y-4 shadow-sm`}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-blue-500">
            <Droplets size={20} />
            <h3 className="font-bold">น้ำดื่ม</h3>
          </div>
          <p className="font-bold">{waterTotal} <span className={`text-xs ${textMuted} font-normal`}>/ 2500มล.</span></p>
        </div>
        <div className="flex gap-2">
          {[150, 250, 500].map((amount) => (
            <motion.button
              key={amount}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                haptics.light();
                addWater(amount);
              }}
              className={`${inputBg} hover:opacity-80 py-2 rounded-xl text-xs font-bold transition-all flex-1 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600 shadow-sm'}`}
            >
              +{amount}มล.
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Food Logs */}
      <section className="space-y-4">
        <h3 className="font-bold text-lg">มื้ออาหารวันนี้</h3>
        <div className="space-y-3">
          {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => {
            const logs = foodLogs.filter(l => l.mealType === type);
            return (
              <div key={type} className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <h4 className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>{mealTypeLabels[type]}</h4>
                  <span className="text-xs font-bold">{logs.reduce((s, l) => s + l.calories, 0)} kcal</span>
                </div>
                <AnimatePresence>
                  {logs.map((log) => (
                    <motion.div 
                      key={log.id} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className={`${cardBg} p-4 rounded-2xl border flex justify-between items-center group shadow-sm`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                          <Utensils size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{log.name}</p>
                          <p className={`text-[10px] ${textMuted}`}>P: {log.protein}ก. • C: {log.carbs}ก. • F: {log.fat}ก.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-bold">{log.calories} <span className={`text-[10px] ${textMuted} font-normal`}>kcal</span></p>
                        <button 
                          onClick={() => log.id && deleteFood(log.id)}
                          className="text-zinc-600 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {logs.length === 0 && (
                  <motion.button 
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setNewFood(prev => ({ ...prev, mealType: type as any }));
                      setShowAddFood(true);
                    }}
                    className={`w-full py-3 border border-dashed rounded-2xl text-xs font-medium transition-all ${
                      theme === 'dark' 
                        ? 'border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700' 
                        : 'border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:border-zinc-300'
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
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl border p-6 space-y-6 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">เพิ่มอาหาร</h2>
                <button onClick={() => setShowAddFood(false)} className={textMuted}>ปิด</button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className={`text-xs font-bold uppercase ${textMuted}`}>ชื่ออาหาร</label>
                  <input 
                    type="text" 
                    value={newFood.name}
                    onChange={e => setNewFood({ ...newFood, name: e.target.value })}
                    className={`w-full border-none rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none ${inputBg} ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}
                    placeholder="เช่น อกไก่ย่าง"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={`text-xs font-bold uppercase ${textMuted}`}>แคลอรี่</label>
                    <input 
                      type="number" 
                      value={newFood.calories}
                      onChange={e => setNewFood({ ...newFood, calories: e.target.value })}
                      className={`w-full border-none rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none ${inputBg} ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-xs font-bold uppercase ${textMuted}`}>มื้ออาหาร</label>
                    <select 
                      value={newFood.mealType}
                      onChange={e => setNewFood({ ...newFood, mealType: e.target.value as any })}
                      className={`w-full border-none rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none ${inputBg} ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}
                    >
                      <option value="breakfast">อาหารเช้า</option>
                      <option value="lunch">อาหารกลางวัน</option>
                      <option value="dinner">อาหารเย็น</option>
                      <option value="snack">ของว่าง</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase ${textMuted}`}>โปรตีน (ก.)</label>
                    <input 
                      type="number" 
                      value={newFood.protein}
                      onChange={e => setNewFood({ ...newFood, protein: e.target.value })}
                      className={`w-full border-none rounded-xl p-3 text-sm outline-none ${inputBg} ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase ${textMuted}`}>คาร์บ (ก.)</label>
                    <input 
                      type="number" 
                      value={newFood.carbs}
                      onChange={e => setNewFood({ ...newFood, carbs: e.target.value })}
                      className={`w-full border-none rounded-xl p-3 text-sm outline-none ${inputBg} ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase ${textMuted}`}>ไขมัน (ก.)</label>
                    <input 
                      type="number" 
                      value={newFood.fat}
                      onChange={e => setNewFood({ ...newFood, fat: e.target.value })}
                      className={`w-full border-none rounded-xl p-3 text-sm outline-none ${inputBg} ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}
                    />
                  </div>
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={addFood}
                className="w-full bg-green-500 text-black font-bold py-4 rounded-2xl hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20"
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
