import React, { useState, useEffect, useMemo } from 'react';
import { Scale, Target, TrendingUp, Plus, Camera, Ruler, Activity, Info, Heart, Droplets, Thermometer, ChevronRight, History, Wind } from 'lucide-react';
import { db, type BodyMetric, type User, type Vital } from '../lib/db';
import { haptics } from '../lib/haptics';
import { format } from 'date-fns';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, CartesianGrid, AreaChart, Area, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../lib/store';
import { firebaseService } from '../lib/firebaseService';

export default function BodyMetrics() {
  const { theme, firebaseUser, user: storeUser } = useAppStore();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'vitals'>('metrics');
  const [chartRange, setChartRange] = useState<'7d' | '1m'>('7d');
  
  // Metric Form State
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [waist, setWaist] = useState('');
  const [showAddMetric, setShowAddMetric] = useState(false);

  // Vital Form State
  const [showAddVital, setShowAddVital] = useState(false);
  const [vitalType, setVitalType] = useState<Vital['type']>('heart_rate');
  const [vitalVal1, setVitalVal1] = useState('');
  const [vitalVal2, setVitalVal2] = useState('');

  useEffect(() => {
    let unsubscribeMetrics: () => void;
    let unsubscribeVitals: () => void;

    if (firebaseUser) {
      unsubscribeMetrics = firebaseService.subscribeToCollection<BodyMetric>('bodyMetrics', firebaseUser.uid, (data) => {
        setMetrics(data.sort((a, b) => a.date.localeCompare(b.date)));
      });
      unsubscribeVitals = firebaseService.subscribeToCollection<Vital>('vitals', firebaseUser.uid, (data) => {
        setVitals(data.sort((a, b) => a.date.localeCompare(b.date)));
      });
      setUser(storeUser);
    } else {
      loadData();
    }

    return () => {
      unsubscribeMetrics?.();
      unsubscribeVitals?.();
    };
  }, [firebaseUser, storeUser]);

  const loadData = async () => {
    const metricsData = await db.bodyMetrics.orderBy('date').toArray();
    const vitalsData = await db.vitals.orderBy('date').toArray();
    const userData = await db.users.toCollection().first();
    setMetrics(metricsData);
    setVitals(vitalsData);
    setUser(userData || null);
  };

  const addMetric = async () => {
    if (!weight) return;
    const w = parseFloat(weight);
    if (isNaN(w) || w < 20 || w > 300) return;
    haptics.success();
    const metric: any = {
      date: format(new Date(), 'yyyy-MM-dd'),
      weightKg: parseFloat(weight),
      bodyFatPct: bodyFat ? parseFloat(bodyFat) : undefined,
      waistCm: waist ? parseFloat(waist) : undefined,
    };

    if (firebaseUser) {
      await firebaseService.addToCollection('bodyMetrics', metric);
    } else {
      await db.bodyMetrics.add(metric as BodyMetric);
      loadData();
    }

    setWeight('');
    setBodyFat('');
    setWaist('');
    setShowAddMetric(false);
  };

  const addVital = async () => {
    if (!vitalVal1) return;
    haptics.success();
    const vital: any = {
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
      type: vitalType,
      value1: parseFloat(vitalVal1),
      value2: vitalVal2 ? parseFloat(vitalVal2) : undefined,
      unit: vitalType === 'blood_pressure' ? 'mmHg' : 
            vitalType === 'heart_rate' ? 'BPM' : 
            vitalType === 'glucose' ? 'mg/dL' : '%',
    };

    if (firebaseUser) {
      await firebaseService.addToCollection('vitals', vital);
    } else {
      await db.vitals.add(vital as Vital);
      loadData();
    }

    setVitalVal1('');
    setVitalVal2('');
    setShowAddVital(false);
  };

  const calculateBMI = (weightKg: number, heightCm: number) => {
    if (!heightCm) return 0;
    const heightM = heightCm / 100;
    return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
  };

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { label: 'น้ำหนักน้อย', color: 'text-blue-400', hex: '#60a5fa' };
    if (bmi < 23) return { label: 'ปกติ', color: 'text-green-400', hex: '#4ade80' };
    if (bmi < 25) return { label: 'น้ำหนักเกิน', color: 'text-yellow-400', hex: '#facc15' };
    if (bmi < 30) return { label: 'อ้วน', color: 'text-orange-400', hex: '#fb923c' };
    return { label: 'อ้วนมาก', color: 'text-red-400', hex: '#f87171' };
  };

  const filteredMetrics = useMemo(() => {
    if (chartRange === '7d') return metrics.slice(-7);
    return metrics.slice(-30);
  }, [metrics, chartRange]);

  const chartData = filteredMetrics.map(m => {
    const bmi = user?.height ? calculateBMI(m.weightKg, user.height) : 0;
    return {
      date: format(new Date(m.date), 'd MMM'),
      weight: m.weightKg,
      bmi: bmi
    };
  });

  const lastMetric = metrics[metrics.length - 1];
  const currentWeight = lastMetric?.weightKg;
  const currentBMI = user?.height && currentWeight ? calculateBMI(currentWeight, user.height) : null;
  const bmiCategory = currentBMI ? getBMICategory(currentBMI) : null;
  const currentWaist = lastMetric?.waistCm;

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'glass-card' : 'glass-card-light';
  const textMuted = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const inputBg = isDark ? 'input-premium text-white' : 'input-premium-light text-zinc-900';
  const gridColor = isDark ? '#27272a' : '#e4e4e7';
  const tooltipBg = isDark ? '#18181b' : '#ffffff';
  const tooltipText = isDark ? '#f4f4f5' : '#18181b';

  return (
    <div className="p-5 space-y-5 pb-28">
      <header className="flex justify-between items-center px-1">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${textMuted} mb-0.5`}>Body</p>
          <h1 className="text-2xl font-bold tracking-tight">ร่างกาย & สัญญาณชีพ</h1>
        </div>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            haptics.light();
            activeSubTab === 'metrics' ? setShowAddMetric(true) : setShowAddVital(true);
          }}
          className="bg-green-500 text-black p-3 rounded-2xl shadow-lg shadow-green-500/20"
        >
          <Plus size={24} />
        </motion.button>
      </header>

      {/* Sub Tabs */}
      <div className={`flex p-1 rounded-2xl ${isDark ? 'bg-white/[0.03]' : 'bg-black/[0.03]'} border ${isDark ? 'border-white/[0.04]' : 'border-black/[0.04]'}`}>
        <button 
          onClick={() => {
            haptics.light();
            setActiveSubTab('metrics');
          }}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'metrics' ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' : textMuted}`}
        >
          สัดส่วนร่างกาย
        </button>
        <button 
          onClick={() => {
            haptics.light();
            setActiveSubTab('vitals');
          }}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'vitals' ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' : textMuted}`}
        >
          สัญญาณชีพ (Vitals)
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'metrics' ? (
          <motion.div 
            key="metrics"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            {/* Current Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`${cardBg} p-5 bento-card flex flex-col justify-between aspect-square`}>
                <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center">
                  <Scale size={20} />
                </div>
                <div>
                  <p className={`${textMuted} text-[10px] font-bold uppercase tracking-widest`}>น้ำหนักปัจจุบัน</p>
                  <div className="flex items-baseline gap-1">
                    <h2 className="text-3xl font-bold">{currentWeight || '--'}</h2>
                    <span className={`${textMuted} text-xs`}>กก.</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <p className="text-[10px] text-green-500 font-bold">เป้าหมาย {user?.targetWeight} กก.</p>
                </div>
              </div>

              <div className={`${cardBg} p-5 bento-card flex flex-col justify-between aspect-square`}>
                <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center">
                  <Activity size={20} />
                </div>
                <div>
                  <p className={`${textMuted} text-[10px] font-bold uppercase tracking-widest`}>BMI</p>
                  <div className="flex items-baseline gap-1">
                    <h2 className="text-3xl font-bold">{currentBMI || '--'}</h2>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <p className={`text-[10px] font-bold ${bmiCategory?.color || textMuted}`}>{bmiCategory?.label || 'ไม่มีข้อมูล'}</p>
                </div>
              </div>
            </div>

            {/* Weight Chart */}
            <div className={`${cardBg} p-5 bento-card space-y-4`}>
              <div className="flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                  <TrendingUp size={18} className="text-green-500" />
                  ความคืบหน้า
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setChartRange('7d')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold ${chartRange === '7d' ? (isDark ? 'bg-white/[0.06] text-white' : 'bg-black/[0.06] text-zinc-900') : 'text-zinc-500'}`}
                  >7D</button>
                  <button 
                    onClick={() => setChartRange('1m')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold ${chartRange === '1m' ? (isDark ? 'bg-white/[0.06] text-white' : 'bg-black/[0.06] text-zinc-900') : 'text-zinc-500'}`}
                  >1M</button>
                </div>
              </div>
              <div className="h-64 w-full" style={{ minWidth: 0 }}>
                {chartData.length > 1 ? (
                  <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1} debounce={1}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: tooltipBg, border: 'none', borderRadius: '12px', fontSize: '12px', color: tooltipText, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ color: '#22c55e' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#22c55e" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#colorWeight)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className={`h-full flex items-center justify-center ${textMuted} text-sm italic`}>
                    บันทึกน้ำหนักเพื่อดูความคืบหน้า
                  </div>
                )}
              </div>
            </div>

            {/* Photos Section */}
            <section className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="font-bold text-lg">รูปภาพความคืบหน้า</h3>
              </div>
              <div className={`text-center py-10 rounded-[1.75rem] border border-dashed ${isDark ? 'text-zinc-600 bg-white/[0.02] border-white/[0.06]' : 'text-zinc-400 bg-black/[0.02] border-black/[0.06]'}`}>
                <Camera size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">ฟีเจอร์นี้จะเปิดให้ใช้งานเร็วๆ นี้</p>
                <p className={`text-xs mt-1 ${textMuted}`}>บันทึกภาพเพื่อติดตามความเปลี่ยนแปลงของร่างกาย</p>
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div 
            key="vitals"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Vitals Summary Grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { type: 'heart_rate', label: 'อัตราการเต้นหัวใจ', icon: Heart, color: 'text-red-500', bg: 'bg-red-500/10', unit: 'BPM' },
                { type: 'blood_pressure', label: 'ความดันโลหิต', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-500/10', unit: 'mmHg' },
                { type: 'glucose', label: 'ระดับน้ำตาล', icon: Droplets, color: 'text-orange-500', bg: 'bg-orange-500/10', unit: 'mg/dL' },
                { type: 'oxygen', label: 'ออกซิเจนในเลือด', icon: Wind, color: 'text-blue-500', bg: 'bg-blue-500/10', unit: '%' },
              ].map((v, i) => {
                const latest = vitals.filter(item => item.type === v.type).sort((a, b) => b.date.localeCompare(a.date))[0];
                return (
                  <div key={i} className={`${cardBg} p-4 bento-card flex flex-col justify-between aspect-square`}>
                    <div className={`w-10 h-10 ${v.bg} ${v.color} rounded-xl flex items-center justify-center`}>
                      <v.icon size={20} />
                    </div>
                    <div>
                      <p className={`${textMuted} text-[10px] font-bold uppercase tracking-widest`}>{v.label}</p>
                      <div className="flex items-baseline gap-1">
                        <h2 className="text-2xl font-bold">{latest ? (v.type === 'blood_pressure' ? `${latest.value1}/${latest.value2}` : latest.value1) : '--'}</h2>
                        <span className={`${textMuted} text-[10px]`}>{v.unit}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/5">
                      <p className="text-[8px] text-zinc-500 font-bold uppercase">{latest ? format(new Date(latest.date), 'd MMM yyyy') : 'ไม่มีข้อมูล'}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vitals History List */}
            <section className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="font-bold text-lg">ประวัติล่าสุด</h3>
                <button className={`text-xs font-bold ${textMuted} flex items-center gap-1`}>
                  <History size={14} /> ดูทั้งหมด
                </button>
              </div>
              <div className="space-y-3">
                {vitals.length > 0 ? vitals.slice(-5).reverse().map((v, i) => (
                  <div key={i} className={`${cardBg} p-3.5 bento-card flex items-center justify-between`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        v.type === 'heart_rate' ? 'bg-red-500/10 text-red-500' :
                        v.type === 'blood_pressure' ? 'bg-purple-500/10 text-purple-500' :
                        v.type === 'glucose' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {v.type === 'heart_rate' ? <Heart size={20} /> :
                         v.type === 'blood_pressure' ? <Activity size={20} /> :
                         v.type === 'glucose' ? <Droplets size={20} /> : <Wind size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-sm">
                          {v.type === 'blood_pressure' ? 'ความดันโลหิต' :
                           v.type === 'heart_rate' ? 'อัตราการเต้นหัวใจ' :
                           v.type === 'glucose' ? 'ระดับน้ำตาล' : 'ออกซิเจนในเลือด'}
                        </p>
                        <p className={`text-[10px] ${textMuted}`}>{format(new Date(v.date), 'd MMM')} • {v.time}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{v.type === 'blood_pressure' ? `${v.value1}/${v.value2}` : v.value1} <span className="text-[10px] font-normal text-zinc-500">{v.unit}</span></p>
                    </div>
                  </div>
                )) : (
                  <div className={`p-8 text-center ${textMuted} italic text-sm`}>ยังไม่มีการบันทึกสัญญาณชีพ</div>
                )}
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Metric Modal */}
      <AnimatePresence>
        {showAddMetric && (
          <div className="fixed inset-0 modal-backdrop z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAddMetric(false)}>
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className={`w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-5 ${isDark ? 'bg-[#141414] border border-white/[0.06]' : 'bg-white border border-black/[0.06] shadow-2xl'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">บันทึกสัดส่วน</h2>
                <button onClick={() => setShowAddMetric(false)} className={textMuted}>ปิด</button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>น้ำหนัก (กก.)</label>
                  <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className={`w-full ${inputBg} rounded-xl p-4`} placeholder="0.0" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>ไขมัน (%)</label>
                    <input type="number" step="0.1" value={bodyFat} onChange={e => setBodyFat(e.target.value)} className={`w-full ${inputBg} rounded-xl p-4`} placeholder="0.0" />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>รอบเอว (ซม.)</label>
                    <input type="number" step="0.1" value={waist} onChange={e => setWaist(e.target.value)} className={`w-full border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-green-500 ${inputBg}`} placeholder="0.0" />
                  </div>
                </div>
              </div>
              <button onClick={addMetric} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold py-4 rounded-2xl shadow-lg shadow-green-500/20">บันทึกข้อมูล</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Vital Modal */}
      <AnimatePresence>
        {showAddVital && (
          <div className="fixed inset-0 modal-backdrop z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAddVital(false)}>
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className={`w-full max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 space-y-5 ${isDark ? 'bg-[#141414] border border-white/[0.06]' : 'bg-white border border-black/[0.06] shadow-2xl'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">บันทึกสัญญาณชีพ</h2>
                <button onClick={() => setShowAddVital(false)} className={textMuted}>ปิด</button>
              </div>
              
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {[
                  { id: 'heart_rate', label: 'ชีพจร', icon: Heart },
                  { id: 'blood_pressure', label: 'ความดัน', icon: Activity },
                  { id: 'glucose', label: 'น้ำตาล', icon: Droplets },
                  { id: 'oxygen', label: 'ออกซิเจน', icon: Wind },
                ].map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setVitalType(t.id as any)}
                    className={`flex-shrink-0 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${vitalType === t.id ? 'bg-green-500 text-black' : (isDark ? 'bg-white/[0.04] text-zinc-400' : 'bg-black/[0.03] text-zinc-500')}`}
                  >
                    <t.icon size={14} /> {t.label}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>
                      {vitalType === 'blood_pressure' ? 'Systolic (ตัวบน)' : 'ค่าที่วัดได้'}
                    </label>
                    <input type="number" value={vitalVal1} onChange={e => setVitalVal1(e.target.value)} className={`w-full ${inputBg} rounded-xl p-4`} placeholder="0" />
                  </div>
                  {vitalType === 'blood_pressure' && (
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>Diastolic (ตัวล่าง)</label>
                      <input type="number" value={vitalVal2} onChange={e => setVitalVal2(e.target.value)} className={`w-full ${inputBg} rounded-xl p-4`} placeholder="0" />
                    </div>
                  )}
                </div>
              </div>
              <button onClick={addVital} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold py-4 rounded-2xl shadow-lg shadow-green-500/20">บันทึกสัญญาณชีพ</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
