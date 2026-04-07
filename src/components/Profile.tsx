import React, { useState, useEffect } from 'react';
import { User, Target, Award, Calendar, Ruler, Weight, Activity, ChevronRight, Edit2, Heart, Droplets, Zap, Moon, Flame, LogIn, LogOut } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { db, type Vital, type FoodLog, type WaterLog } from '../lib/db';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { firebaseService } from '../lib/firebaseService';

export default function Profile() {
  const { user, theme, setActiveTab, firebaseUser, login, logout } = useAppStore();
  const [latestVitals, setLatestVitals] = useState<Vital[]>([]);
  const [todayNutrition, setTodayNutrition] = useState({ calories: 0, water: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const cardBg = theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200';
  const textMuted = theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400';
  const accentColor = 'text-green-500';

  useEffect(() => {
    let unsubscribeVitals: () => void;
    let unsubscribeFood: () => void;
    let unsubscribeWater: () => void;

    const today = format(new Date(), 'yyyy-MM-dd');

    if (firebaseUser) {
      setIsLoading(true);
      unsubscribeVitals = firebaseService.subscribeToCollection<Vital>('vitals', firebaseUser.uid, (data) => {
        const uniqueVitals: Record<string, Vital> = {};
        data.sort((a, b) => b.date.localeCompare(a.date)).forEach(v => {
          if (!uniqueVitals[v.type]) uniqueVitals[v.type] = v;
        });
        setLatestVitals(Object.values(uniqueVitals));
        setIsLoading(false);
      });

      unsubscribeFood = firebaseService.subscribeToCollection<FoodLog>('foodLogs', firebaseUser.uid, (data) => {
        const todayFood = data.filter(f => f.date === today);
        setTodayNutrition(prev => ({
          ...prev,
          calories: todayFood.reduce((sum, f) => sum + f.calories, 0)
        }));
      });

      unsubscribeWater = firebaseService.subscribeToCollection<WaterLog>('waterLogs', firebaseUser.uid, (data) => {
        const todayWater = data.filter(w => w.date === today);
        setTodayNutrition(prev => ({
          ...prev,
          water: todayWater.reduce((sum, w) => sum + w.amountMl, 0)
        }));
      });
    } else {
      loadProfileData();
    }

    return () => {
      unsubscribeVitals?.();
      unsubscribeFood?.();
      unsubscribeWater?.();
    };
  }, [firebaseUser]);

  const loadProfileData = async () => {
    setIsLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Fetch latest unique vitals
    const allVitals = await db.vitals.orderBy('date').reverse().limit(20).toArray();
    const uniqueVitals: Record<string, Vital> = {};
    allVitals.forEach(v => {
      if (!uniqueVitals[v.type]) uniqueVitals[v.type] = v;
    });
    setLatestVitals(Object.values(uniqueVitals));

    // Fetch today's nutrition
    const foodLogs = await db.foodLogs.where('date').equals(today).toArray();
    const waterLogs = await db.waterLogs.where('date').equals(today).toArray();
    
    setTodayNutrition({
      calories: foodLogs.reduce((sum, f) => sum + f.calories, 0),
      water: waterLogs.reduce((sum, w) => sum + w.amountMl, 0)
    });
    
    setIsLoading(false);
  };

  const stats = [
    { label: 'อายุ', value: `${user?.age} ปี`, icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'ส่วนสูง', value: `${user?.height} ซม.`, icon: Ruler, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'น้ำหนักปัจจุบัน', value: `${user?.weight} กก.`, icon: Weight, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'เป้าหมาย', value: `${user?.targetWeight} กก.`, icon: Target, color: 'text-green-500', bg: 'bg-green-500/10' },
  ];

  const bmi = user ? (user.weight / ((user.height / 100) ** 2)).toFixed(1) : '0';
  
  const getBMICategory = (bmiVal: number) => {
    if (bmiVal < 18.5) return { label: 'น้ำหนักน้อย', color: 'text-blue-500' };
    if (bmiVal < 23) return { label: 'ปกติ', color: 'text-green-500' };
    if (bmiVal < 25) return { label: 'น้ำหนักเกิน', color: 'text-yellow-500' };
    if (bmiVal < 30) return { label: 'อ้วน', color: 'text-orange-500' };
    return { label: 'อ้วนมาก', color: 'text-red-500' };
  };

  const bmiInfo = getBMICategory(parseFloat(bmi));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-32">
      <header className="flex justify-between items-center">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted} mb-1`}>Your Health Hub</p>
          <h1 className="text-2xl font-bold">โปรไฟล์</h1>
        </div>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab('settings')}
            className={`p-2 rounded-xl border ${cardBg} ${textMuted} hover:text-green-500 transition-colors`}
          >
            <Edit2 size={20} />
          </motion.button>
        </div>
      </header>

      {/* Profile Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBg} rounded-[32px] border p-8 text-center space-y-4 shadow-xl shadow-black/5 relative overflow-hidden`}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
        
        <div className="relative inline-block">
          {firebaseUser?.photoURL ? (
            <img 
              src={firebaseUser.photoURL} 
              alt={user?.name || 'Profile'} 
              className="w-24 h-24 rounded-3xl object-cover shadow-lg shadow-green-500/20 mx-auto"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-3xl flex items-center justify-center text-black font-bold text-4xl shadow-lg shadow-green-500/20 mx-auto">
              {user?.name?.[0] || (user?.gender === 'male' ? 'M' : 'F')}
            </div>
          )}
          <div className="absolute -bottom-2 -right-2 bg-zinc-900 border-4 border-black rounded-full p-1 text-green-500">
            <Award size={20} />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold">{user?.name || 'ผู้ใช้งาน'}</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
              {firebaseUser ? 'Online Member' : 'LifeOS Member'}
            </span>
            {firebaseUser && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'bg-green-500/10 text-green-500' : 'bg-green-100 text-green-600'}`}>
                Synced
              </span>
            )}
          </div>
        </div>
        
        <div className="pt-4 grid grid-cols-2 gap-4">
          <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-zinc-800/50' : 'bg-zinc-50'} border border-transparent`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted} mb-1`}>BMI</p>
            <p className="text-xl font-bold">{bmi}</p>
            <p className={`text-[10px] font-bold ${bmiInfo.color}`}>{bmiInfo.label}</p>
          </div>
          <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-zinc-800/50' : 'bg-zinc-50'} border border-transparent`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted} mb-1`}>เป้าหมายแคลอรี่</p>
            <p className="text-xl font-bold">{user?.dailyCalorieTarget}</p>
            <p className={`text-[10px] font-bold ${textMuted}`}>กิโลแคลอรี่</p>
          </div>
        </div>
      </motion.div>

      {/* Today's Glanceable Metrics */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold px-1">สรุปสุขภาพวันนี้</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className={`${cardBg} rounded-3xl border p-5 flex items-center gap-4`}>
            <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center">
              <Flame size={24} />
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>พลังงาน</p>
              <p className="text-lg font-bold">{todayNutrition.calories} <span className="text-xs font-normal">kcal</span></p>
            </div>
          </div>
          <div className={`${cardBg} rounded-3xl border p-5 flex items-center gap-4`}>
            <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center">
              <Droplets size={24} />
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>น้ำดื่ม</p>
              <p className="text-lg font-bold">{todayNutrition.water} <span className="text-xs font-normal">ml</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Vitals */}
      {latestVitals.length > 0 && (
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-lg font-bold">สัญญาณชีพล่าสุด</h3>
            <button onClick={() => setActiveTab('metrics')} className="text-xs font-bold text-green-500 uppercase tracking-wider">ดูทั้งหมด</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {latestVitals.map((vital) => (
              <div key={vital.id} className={`${cardBg} rounded-3xl border p-5 space-y-2`}>
                <div className="flex justify-between items-start">
                  <div className={`p-2 rounded-lg ${
                    vital.type === 'heart_rate' ? 'bg-red-500/10 text-red-500' :
                    vital.type === 'blood_pressure' ? 'bg-blue-500/10 text-blue-500' :
                    vital.type === 'glucose' ? 'bg-orange-500/10 text-orange-500' :
                    'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    {vital.type === 'heart_rate' ? <Heart size={16} /> :
                     vital.type === 'blood_pressure' ? <Activity size={16} /> :
                     vital.type === 'glucose' ? <Zap size={16} /> :
                     <Droplets size={16} />}
                  </div>
                  <span className={`text-[10px] font-bold ${textMuted}`}>{format(new Date(vital.date), 'dd MMM')}</span>
                </div>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>
                    {vital.type === 'heart_rate' ? 'อัตราการเต้นหัวใจ' :
                     vital.type === 'blood_pressure' ? 'ความดันโลหิต' :
                     vital.type === 'glucose' ? 'ระดับน้ำตาล' :
                     'ออกซิเจนในเลือด'}
                  </p>
                  <p className="text-lg font-bold">
                    {vital.value1}{vital.value2 ? `/${vital.value2}` : ''} <span className="text-xs font-normal">{vital.unit}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sync Status / Auth */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold px-1">การเชื่อมต่อข้อมูล</h3>
        <div className={`${cardBg} rounded-3xl border p-6 space-y-4`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${firebaseUser ? 'bg-green-500/10 text-green-500' : 'bg-zinc-500/10 text-zinc-500'}`}>
              <Activity size={24} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm">{firebaseUser ? 'ซิงค์ข้อมูลออนไลน์แล้ว' : 'ยังไม่ได้ซิงค์ข้อมูล'}</h4>
              <p className={`text-xs ${textMuted}`}>
                {firebaseUser 
                  ? `เชื่อมต่อกับ ${firebaseUser.email}` 
                  : 'เข้าสู่ระบบเพื่อสำรองข้อมูลและใช้งานข้ามอุปกรณ์'}
              </p>
            </div>
          </div>
          
          {firebaseUser ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={logout}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
            >
              <LogOut size={18} />
              ออกจากระบบ
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={login}
              className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-green-500 text-black hover:bg-green-400 transition-colors"
            >
              <LogIn size={18} />
              เข้าสู่ระบบด้วย Google
            </motion.button>
          )}
        </div>
      </section>

      {/* Stats Grid */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold px-1">ข้อมูลพื้นฐาน</h3>
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className={`${cardBg} rounded-3xl border p-5 space-y-3`}
            >
              <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center`}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>{stat.label}</p>
                <p className="text-lg font-bold">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Achievements */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold px-1">ความสำเร็จ</h3>
        <div className="space-y-3">
          {[
            { title: 'ผู้เริ่มต้นสุขภาพดี', desc: 'เริ่มบันทึกข้อมูลสุขภาพครั้งแรก', icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10', completed: true },
            { title: 'นักล่าแคลอรี่', desc: 'บันทึกอาหารครบ 7 วันต่อเนื่อง', icon: Target, color: 'text-orange-500', bg: 'bg-orange-500/10', completed: false },
            { title: 'เจ้าแห่งการนอน', desc: 'นอนหลับคุณภาพดีครบ 5 วัน', icon: Award, color: 'text-blue-500', bg: 'bg-blue-500/10', completed: false },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className={`${cardBg} rounded-2xl border p-4 flex items-center gap-4 opacity-${item.completed ? '100' : '50'}`}
            >
              <div className={`w-12 h-12 ${item.bg} ${item.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <item.icon size={24} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm">{item.title}</h4>
                <p className={`text-xs ${textMuted}`}>{item.desc}</p>
              </div>
              {item.completed ? (
                <div className="w-6 h-6 bg-green-500 text-black rounded-full flex items-center justify-center">
                  <ChevronRight size={14} strokeWidth={3} />
                </div>
              ) : (
                <div className="w-6 h-6 border-2 border-zinc-800 rounded-full" />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setActiveTab('settings')}
        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors ${
          theme === 'dark' ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
        }`}
      >
        จัดการบัญชีและการตั้งค่า
      </motion.button>
    </div>
  );
}
