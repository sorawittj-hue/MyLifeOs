import React, { useState, useEffect } from 'react';
import { Moon, Sun, Clock, Star, Plus, Trash2, TrendingUp } from 'lucide-react';
import { db, type SleepLog } from '../lib/db';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../lib/store';
import { firebaseService } from '../lib/firebaseService';

export default function SleepTracker() {
  const { theme, firebaseUser } = useAppStore();
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [bedtime, setBedtime] = useState('22:00');
  const [wakeTime, setWakeTime] = useState('06:00');
  const [quality, setQuality] = useState(4);

  useEffect(() => {
    let unsubscribe: () => void;

    if (firebaseUser) {
      unsubscribe = firebaseService.subscribeToCollection('sleepLogs', firebaseUser.uid, (data) => {
        setLogs(data.sort((a, b) => a.date.localeCompare(b.date)).slice(-7) as SleepLog[]);
      });
    } else {
      loadLogs();
    }

    return () => unsubscribe?.();
  }, [firebaseUser]);

  const loadLogs = async () => {
    const data = await db.sleepLogs.orderBy('date').reverse().limit(7).toArray();
    setLogs(data.reverse());
  };

  const addLog = async () => {
    const log: any = {
      date: format(new Date(), 'yyyy-MM-dd'),
      bedtime,
      wakeTime,
      quality,
      timestamp: Date.now()
    };

    if (firebaseUser) {
      await firebaseService.addToCollection('sleepLogs', log);
    } else {
      await db.sleepLogs.add(log as SleepLog);
      loadLogs();
    }
    
    setShowAdd(false);
  };

  const calculateDuration = (bed: string, wake: string) => {
    const [bh, bm] = bed.split(':').map(Number);
    const [wh, wm] = wake.split(':').map(Number);
    
    let hours = wh - bh;
    let minutes = wm - bm;
    
    if (hours < 0) hours += 24;
    if (minutes < 0) {
      minutes += 60;
      hours -= 1;
    }
    
    return hours + (minutes / 60);
  };

  const chartData = logs.map(l => ({
    date: format(new Date(l.date), 'EEE'),
    hours: calculateDuration(l.bedtime, l.wakeTime)
  }));

  const avgSleep = chartData.length > 0 
    ? (chartData.reduce((s, d) => s + d.hours, 0) / chartData.length).toFixed(1)
    : '0';

  const cardBg = theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200';
  const textMuted = theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400';
  const inputBg = theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100';
  const tooltipBg = theme === 'dark' ? '#18181b' : '#ffffff';
  const tooltipText = theme === 'dark' ? '#f4f4f5' : '#18181b';

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">การนอนหลับ</h1>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAdd(true)}
          className="bg-green-500 text-black p-2 rounded-xl shadow-lg shadow-green-500/20"
        >
          <Plus size={24} />
        </motion.button>
      </header>

      {/* Summary Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBg} p-6 rounded-3xl border flex justify-between items-center shadow-sm`}
      >
        <div className="space-y-1">
          <p className={`${textMuted} text-xs font-bold uppercase tracking-widest`}>นอนเฉลี่ย</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-4xl font-bold">{avgSleep}</h2>
            <span className={`${textMuted} font-medium`}>ชม.</span>
          </div>
        </div>
        <div className="text-right space-y-1">
          <p className={`${textMuted} text-xs font-bold uppercase tracking-widest`}>หนี้การนอน</p>
          <h2 className="text-2xl font-bold text-red-500">-1.5 <span className={`text-xs ${textMuted} font-normal`}>ชม.</span></h2>
        </div>
      </motion.div>

      {/* Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`${cardBg} p-6 rounded-3xl border space-y-4 shadow-sm`}
      >
        <h3 className="font-bold flex items-center gap-2">
          <TrendingUp size={18} className="text-green-500" />
          ระยะเวลาการนอน
        </h3>
        <div className="h-48 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis hide domain={[0, 12]} />
                <Tooltip 
                  cursor={{ fill: theme === 'dark' ? '#27272a' : '#f4f4f5' }}
                  contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: '12px', fontSize: '12px', color: tooltipText, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="hours" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={`h-full flex items-center justify-center ${textMuted} text-sm italic`}>
              บันทึกการนอนเพื่อดูแนวโน้ม
            </div>
          )}
        </div>
      </motion.div>

      {/* Tips Section */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className={`p-5 rounded-3xl space-y-2 border ${theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}
      >
        <div className="flex items-center gap-2 text-blue-500">
          <Moon size={18} />
          <h3 className="font-bold text-sm uppercase tracking-wider">เคล็ดลับการนอน</h3>
        </div>
        <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-600'}`}>
          ความสม่ำเสมอในการนอนของคุณคือ 85% พยายามตื่นเวลาเดิมให้ห่างกันไม่เกิน 30 นาที แม้ในวันหยุด เพื่อรักษานาฬิกาชีวิตที่ดีขึ้น
        </p>
      </motion.div>

      {/* History */}
      <section className="space-y-4">
        <h3 className="font-bold text-lg">ประวัติการนอน</h3>
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {logs.map((log, idx) => (
              <motion.div 
                key={log.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`${cardBg} p-4 rounded-2xl border flex justify-between items-center shadow-sm`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                    <Moon size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{format(new Date(log.date), 'd MMM yyyy')}</p>
                    <p className={`text-[10px] uppercase font-bold tracking-wider ${textMuted}`}>
                      {log.bedtime} - {log.wakeTime}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{calculateDuration(log.bedtime, log.wakeTime).toFixed(1)} <span className={`text-[10px] font-normal ${textMuted}`}>ชม.</span></p>
                  <div className="flex gap-0.5 justify-end">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={8} className={i < log.quality ? 'text-yellow-500 fill-yellow-500' : (theme === 'dark' ? 'text-zinc-800' : 'text-zinc-200')} />
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* Add Modal */}
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
                <h2 className="text-xl font-bold">บันทึกการนอน</h2>
                <button onClick={() => setShowAdd(false)} className={textMuted}>ปิด</button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={`text-xs font-bold uppercase ${textMuted}`}>เวลานอน</label>
                    <input 
                      type="time" 
                      value={bedtime}
                      onChange={e => setBedtime(e.target.value)}
                      className={`w-full border-none rounded-xl p-4 outline-none focus:ring-2 focus:ring-green-500 ${inputBg} ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-xs font-bold uppercase ${textMuted}`}>เวลาตื่น</label>
                    <input 
                      type="time" 
                      value={wakeTime}
                      onChange={e => setWakeTime(e.target.value)}
                      className={`w-full border-none rounded-xl p-4 outline-none focus:ring-2 focus:ring-green-500 ${inputBg} ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={`text-xs font-bold uppercase ${textMuted}`}>คุณภาพการนอน</label>
                  <div className="flex justify-between gap-2">
                    {[1, 2, 3, 4, 5].map(q => (
                      <motion.button 
                        key={q}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setQuality(q)}
                        className={`flex-1 py-3 rounded-xl border transition-all ${
                          quality === q 
                            ? 'bg-green-500 border-green-500 text-black' 
                            : theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-zinc-100 border-zinc-200 text-zinc-500'
                        }`}
                      >
                        {q}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={addLog}
                className="w-full bg-green-500 text-black font-bold py-4 rounded-2xl shadow-lg shadow-green-500/20"
              >
                บันทึกข้อมูล
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
