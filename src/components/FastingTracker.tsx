import React, { useState, useEffect, useMemo } from 'react';
import { Play, Square, Timer, Flame, History, ChevronRight, Info, Coffee, Droplets, Moon, Sun, Clock, UtensilsCrossed, Store, ChefHat, Egg, Leaf, Zap, ShoppingBag, Heart, X } from 'lucide-react';
import { db, type FastingSession } from '../lib/db';
import { haptics } from '../lib/haptics';
import { format, differenceInSeconds, addHours, setHours, setMinutes, isAfter, isBefore } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../lib/store';
import { firebaseService } from '../lib/firebaseService';
import { FastingStateTimeline } from './FastingStates';

interface ProtocolWindow {
  id: string;
  label: string;
  fastStart: string;
  fastEnd: string;
  eatStart: string;
  eatEnd: string;
}

interface ProtocolInfo {
  id: string;
  label: string;
  fastHours: number;
  eatHours: number;
  description: string;
  recommendation: string;
  windows: ProtocolWindow[];
}

const PROTOCOLS: ProtocolInfo[] = [
  {
    id: '14:10',
    label: '14:10',
    fastHours: 14,
    eatHours: 10,
    description: 'เหมาะสำหรับผู้เริ่มต้น',
    recommendation: 'เริ่มหยุดกินหลังมื้อเย็น และเริ่มมื้อแรกตอนสายๆ',
    windows: [
      { id: '14-std', label: 'มาตรฐาน', fastStart: '20:00', fastEnd: '10:00', eatStart: '10:00', eatEnd: '20:00' },
      { id: '14-early', label: 'ตื่นเช้า', fastStart: '18:00', fastEnd: '08:00', eatStart: '08:00', eatEnd: '18:00' },
    ]
  },
  {
    id: '16:8',
    label: '16:8',
    fastHours: 16,
    eatHours: 8,
    description: 'สูตรยอดนิยม เห็นผลดี',
    recommendation: 'ข้ามมื้อเช้า เริ่มมื้อแรกตอนเที่ยง และจบมื้อสุดท้ายก่อน 2 ทุ่ม',
    windows: [
      { id: '16-std', label: 'ยอดนิยม', fastStart: '20:00', fastEnd: '12:00', eatStart: '12:00', eatEnd: '20:00' },
      { id: '16-early', label: 'เช้าตรู่', fastStart: '16:00', fastEnd: '08:00', eatStart: '08:00', eatEnd: '16:00' },
      { id: '16-late', label: 'นอนดึก', fastStart: '00:00', fastEnd: '16:00', eatStart: '16:00', eatEnd: '00:00' },
    ]
  },
  {
    id: '18:6',
    label: '18:6',
    fastHours: 18,
    eatHours: 6,
    description: 'สำหรับผู้ที่คุ้นเคยแล้ว',
    recommendation: 'เน้นการเผาผลาญไขมันที่เข้มข้นขึ้น กินเพียง 2 มื้อหลัก',
    windows: [
      { id: '18-std', label: 'มาตรฐาน', fastStart: '18:00', fastEnd: '12:00', eatStart: '12:00', eatEnd: '18:00' },
      { id: '18-noon', label: 'บ่าย-เย็น', fastStart: '20:00', fastEnd: '14:00', eatStart: '14:00', eatEnd: '20:00' },
    ]
  },
  {
    id: '20:4',
    label: '20:4',
    fastHours: 20,
    eatHours: 4,
    description: 'Warrior Diet',
    recommendation: 'อดอาหารเกือบทั้งวัน และกินมื้อใหญ่ในช่วงเย็น',
    windows: [
      { id: '20-std', label: 'มาตรฐาน', fastStart: '20:00', fastEnd: '16:00', eatStart: '16:00', eatEnd: '20:00' },
    ]
  },
  {
    id: 'OMAD',
    label: 'OMAD',
    fastHours: 23,
    eatHours: 1,
    description: 'กินมื้อเดียวต่อวัน',
    recommendation: 'ขั้นสูงสุดของการทำ IF ควรปรึกษาแพทย์หากมีโรคประจำตัว',
    windows: [
      { id: 'omad-std', label: 'มาตรฐาน', fastStart: '20:00', fastEnd: '19:00', eatStart: '19:00', eatEnd: '20:00' },
    ]
  }
];

// ── Meal Recommendation Data ──────────────────────────
interface MealItem {
  name: string;
  calories: number;
  protein: number;
  prepTime: string;
  tip: string;
  tags: string[];
}

interface MealCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
  meals: MealItem[];
}

const MEAL_CATEGORIES: MealCategory[] = [
  {
    id: 'seven',
    label: '7-Eleven',
    icon: <Store size={16} />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    description: 'สะดวก หาง่าย ได้ทุกสาขา',
    meals: [
      {
        name: 'อกไก่อบพริกไทยดำ + ข้าวกล้อง',
        calories: 320,
        protein: 28,
        prepTime: '3 นาที (อุ่นไมโครเวฟ)',
        tip: 'เลือกข้าวกล้องแทนข้าวขาว ได้ไฟเบอร์เพิ่ม',
        tags: ['High Protein', 'Low Fat'],
      },
      {
        name: 'สลัดอกไก่ + ไข่ต้ม',
        calories: 250,
        protein: 32,
        prepTime: 'พร้อมทาน',
        tip: 'ใช้น้ำสลัดญี่ปุ่นแทนมายองเนส ลดแคลลง 100+',
        tags: ['Low Carb', 'High Protein'],
      },
      {
        name: 'แซนด์วิชทูน่าโฮลวีท',
        calories: 280,
        protein: 18,
        prepTime: 'พร้อมทาน',
        tip: 'เลือกแบบโฮลวีทจะอิ่มนานกว่า',
        tags: ['Balanced', 'Fiber'],
      },
      {
        name: 'โยเกิร์ตกรีก + กราโนล่า',
        calories: 180,
        protein: 14,
        prepTime: 'พร้อมทาน',
        tip: 'เลือกแบบไม่หวาน หรือ 0% Fat',
        tags: ['Snack', 'Probiotics'],
      },
      {
        name: 'ข้าวต้มไก่ + ไข่ลวก',
        calories: 200,
        protein: 15,
        prepTime: '3 นาที (อุ่น)',
        tip: 'เหมาะเป็นมื้อแรกหลัง Break Fast เพราะเบาท้อง',
        tags: ['Easy Digest', 'Light'],
      },
    ],
  },
  {
    id: 'homemade',
    label: 'ทำเองง่าย',
    icon: <ChefHat size={16} />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    description: 'ทำเองที่บ้าน ไม่เกิน 15 นาที',
    meals: [
      {
        name: 'ข้าวผัดไข่ + ผักรวม',
        calories: 350,
        protein: 14,
        prepTime: '10 นาที',
        tip: 'ใช้น้ำมันมะกอก ใส่ผักเยอะๆ ลดข้าวลงนิด',
        tags: ['Quick', 'Balanced'],
      },
      {
        name: 'ไข่เจียวหมูสับ + ข้าวสวย',
        calories: 400,
        protein: 22,
        prepTime: '8 นาที',
        tip: 'ใส่ผักบุ้งหรือถั่วฝักยาวเพิ่มไฟเบอร์',
        tags: ['High Protein', 'Thai Classic'],
      },
      {
        name: 'ต้มจืดเต้าหู้หมูสับ',
        calories: 180,
        protein: 18,
        prepTime: '12 นาที',
        tip: 'เครื่องเทศน้อย ย่อยง่าย ดีมากหลัง Break Fast',
        tags: ['Low Cal', 'Easy Digest'],
      },
      {
        name: 'กะเพราไก่สับ (ไม่ทอด)',
        calories: 380,
        protein: 26,
        prepTime: '10 นาที',
        tip: 'ข้ามไข่ดาวถ้าอยากลดแคล ใส่ถั่วฝักยาวเพิ่ม',
        tags: ['Thai Classic', 'High Protein'],
      },
      {
        name: 'โจ๊กหมู + ไข่ลวก + ขิง',
        calories: 220,
        protein: 16,
        prepTime: '15 นาที',
        tip: 'ใส่ขิงเยอะ ช่วยระบบย่อยอาหารหลังอดนาน',
        tags: ['Easy Digest', 'Warm'],
      },
    ],
  },
  {
    id: 'protein',
    label: 'โปรตีนสูง',
    icon: <Egg size={16} />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    description: 'เน้นโปรตีน สร้างกล้ามเนื้อ',
    meals: [
      {
        name: 'อกไก่ย่าง + ข้าวกล้อง + บร็อคโคลี่',
        calories: 380,
        protein: 42,
        prepTime: '15 นาที',
        tip: 'หมักไก่ล่วงหน้า 1 คืน รสชาติจะดีมาก',
        tags: ['Meal Prep', 'Gym'],
      },
      {
        name: 'ไข่ต้ม 3 ฟอง + อะโวคาโด',
        calories: 350,
        protein: 24,
        prepTime: '10 นาที',
        tip: 'ไข่ต้มกึ่งสุก (6 นาที) ให้โปรตีนดูดซึมดีกว่า',
        tags: ['Keto Friendly', 'Simple'],
      },
      {
        name: 'ปลานึ่งมะนาว + ข้าวไรซ์เบอร์รี่',
        calories: 300,
        protein: 35,
        prepTime: '15 นาที',
        tip: 'ปลากะพง หรือปลาทับทิมนึ่ง ไขมันต่ำ โปรตีนเยอะ',
        tags: ['Low Fat', 'Omega-3'],
      },
      {
        name: 'สเต็กหมูพริกไทยดำ + ผักสลัด',
        calories: 420,
        protein: 38,
        prepTime: '12 นาที',
        tip: 'เลือกหมูสันนอก ไขมันน้อย โปรตีนสูง',
        tags: ['High Protein', 'Filling'],
      },
    ],
  },
  {
    id: 'light',
    label: 'เบาๆ ว่าง',
    icon: <Leaf size={16} />,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    description: 'ของว่าง ทานเล่น ไม่อ้วน',
    meals: [
      {
        name: 'กล้วยหอม + เนยถั่ว 1 ช้อน',
        calories: 160,
        protein: 5,
        prepTime: 'พร้อมทาน',
        tip: 'ให้พลังงานเร็ว เหมาะหลัง Break Fast ทันที',
        tags: ['Quick Energy', 'Natural'],
      },
      {
        name: 'ถั่วอัลมอนด์ 1 กำมือ',
        calories: 140,
        protein: 6,
        prepTime: 'พร้อมทาน',
        tip: 'อิ่มนาน ไขมันดี กินเป็นของว่างบ่ายได้',
        tags: ['Healthy Fat', 'Portable'],
      },
      {
        name: 'แอปเปิ้ล + ชีสก้อน',
        calories: 150,
        protein: 8,
        prepTime: 'พร้อมทาน',
        tip: 'ชีสให้โปรตีน + แคลเซียม แอปเปิ้ลให้ไฟเบอร์',
        tags: ['Balanced Snack', 'Easy'],
      },
      {
        name: 'เต้าหู้ไข่เย็น + ซอสโชยุ',
        calories: 80,
        protein: 7,
        prepTime: 'พร้อมทาน',
        tip: 'หาได้ทั้ง 7-11 และซูเปอร์ แคลอรี่ต่ำมาก',
        tags: ['Ultra Low Cal', 'Easy'],
      },
    ],
  },
];

export default function FastingTracker() {
  const { theme, firebaseUser } = useAppStore();
  const isDark = theme === 'dark';
  const [activeSession, setActiveSession] = useState<FastingSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedProtocolId, setSelectedProtocolId] = useState('16:8');
  const [selectedWindowId, setSelectedWindowId] = useState('16-std');
  const [history, setHistory] = useState<FastingSession[]>([]);
  const [showInfo, setShowInfo] = useState(true);
  const [showMealGuide, setShowMealGuide] = useState(false);
  const [selectedMealCategory, setSelectedMealCategory] = useState('seven');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [fullHistory, setFullHistory] = useState<FastingSession[]>([]);


  const currentProtocol = PROTOCOLS.find(p => p.id === selectedProtocolId) || PROTOCOLS[1];
  const currentWindow = currentProtocol.windows.find(w => w.id === selectedWindowId) || currentProtocol.windows[0];

  useEffect(() => {
    if (!activeSession) {
      const defaultWindow = currentProtocol.windows[0];
      setSelectedWindowId(defaultWindow.id);
    }
  }, [selectedProtocolId]);

  useEffect(() => {
    let unsubscribe: () => void;

    if (firebaseUser) {
      unsubscribe = firebaseService.subscribeToCollection<FastingSession>('fastingSessions', firebaseUser.uid, (data) => {
        const active = data.find(s => s.completed === 0);
        const completed = data.filter(s => s.completed === 1).sort((a, b) => (b.endTime || 0) - (a.endTime || 0));
        
        if (active) {
          setActiveSession(active);
          setElapsed(differenceInSeconds(new Date(), new Date(active.startTime)));
          setSelectedProtocolId(active.protocol);
        } else {
          setActiveSession(null);
          setElapsed(0);
        }
        setFullHistory(completed);
        setHistory(completed.slice(0, 10));
      });
    } else {
      loadActiveSession();
      loadHistory();
    }

    return () => unsubscribe?.();
  }, [firebaseUser]);

  useEffect(() => {
    let interval: number;
    if (activeSession) {
      interval = window.setInterval(() => {
        setElapsed(differenceInSeconds(new Date(), new Date(activeSession.startTime)));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const loadActiveSession = async () => {
    const session = await db.fastingSessions.where('completed').equals(0).first();
    if (session) {
      setActiveSession(session);
      setElapsed(differenceInSeconds(new Date(), new Date(session.startTime)));
      setSelectedProtocolId(session.protocol);
    }
  };

  const loadHistory = async () => {
    const sessions = await db.fastingSessions.where('completed').equals(1).reverse().toArray();
    setFullHistory(sessions);
    setHistory(sessions.slice(0, 10));
  };

  const startFast = async () => {
    haptics.medium();
    const newSession: any = {
      startTime: Date.now(),
      protocol: selectedProtocolId,
      completed: 0,
      updatedAt: Date.now(),
      syncStatus: 'pending',
    };

    if (firebaseUser) {
      await firebaseService.addToCollection('fastingSessions', newSession);
    } else {
      const id = await db.fastingSessions.add(newSession as FastingSession);
      setActiveSession({ ...newSession, id });
    }
  };

  const stopFast = async () => {
    if (activeSession?.id) {
      haptics.success();
      if (firebaseUser) {
        await firebaseService.updateInCollection('fastingSessions', activeSession.id.toString(), {
          endTime: Date.now(),
          completed: 1,
        });
      } else {
        await db.fastingSessions.update(activeSession.id as number, {
          endTime: Date.now(),
          completed: 1,
        });
        setActiveSession(null);
        setElapsed(0);
        loadHistory();
      }

      // Update fasting streak via gamification engine
      try {
        const { updateStreak } = await import('../lib/gamification');
        const { streak, newBadges } = await updateStreak('fasting');
        if (newBadges.length > 0) {
          // Could show a toast/notification for new badges
          console.log('🎉 New badges earned:', newBadges.map(b => b.name));
        }
      } catch (e) {
        console.error('Gamification update failed:', e);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const targetSeconds = currentProtocol.fastHours * 3600;
  const safeElapsed = Math.max(0, elapsed);
  const progress = Math.min((safeElapsed / targetSeconds) * 100, 100);
  const isOvertime = safeElapsed >= targetSeconds;

  const radius = 140;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - ((isOvertime ? 100 : progress) / 100) * circumference;

  const cardBg = isDark ? 'glass-card' : 'glass-card-light';
  const textMuted = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const textMain = isDark ? 'text-white' : 'text-zinc-900';

  return (
    <div className="p-5 space-y-5 pb-28">
      <header className="flex justify-between items-end">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted} mb-1`}>Intermittent Fasting</p>
          <h1 className="text-2xl font-bold">การทำ IF</h1>
        </div>
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          {PROTOCOLS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                if (!activeSession) {
                  haptics.light();
                  setSelectedProtocolId(p.id);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedProtocolId === p.id 
                  ? 'bg-green-500 text-black shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              } ${activeSession && selectedProtocolId !== p.id ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Protocol Info Card */}
      <motion.div 
        layout
        className={`${cardBg} bento-card p-5 space-y-4`}
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="font-bold text-lg flex items-center gap-2">
              สูตร {currentProtocol.label}
              <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {currentProtocol.description}
              </span>
            </h3>
            <p className={`text-xs ${textMuted}`}>{currentProtocol.recommendation}</p>
          </div>
          <button 
            onClick={() => {
              haptics.light();
              setShowInfo(!showInfo);
            }}
            className={`p-2 rounded-xl ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.04]'} text-zinc-500`}
          >
            <Info size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-2xl ${isDark ? 'bg-white/[0.03]' : 'bg-black/[0.02]'} border border-transparent`}>
            <div className="flex items-center gap-2 text-blue-500 mb-1">
              <Moon size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">ช่วงอด (Fasting)</span>
            </div>
            <p className="text-sm font-bold">{currentWindow.fastStart} - {currentWindow.fastEnd}</p>
            <p className="text-[10px] text-zinc-500">{currentProtocol.fastHours} ชั่วโมง</p>
          </div>
          <div className={`p-3 rounded-2xl ${theme === 'dark' ? 'bg-zinc-800/50' : 'bg-zinc-50'} border border-transparent`}>
            <div className="flex items-center gap-2 text-orange-500 mb-1">
              <Sun size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">ช่วงกิน (Eating)</span>
            </div>
            <p className="text-sm font-bold">{currentWindow.eatStart} - {currentWindow.eatEnd}</p>
            <p className="text-[10px] text-zinc-500">{currentProtocol.eatHours} ชั่วโมง</p>
          </div>
        </div>

        {/* Window Selection */}
        {!activeSession && currentProtocol.windows.length > 1 && (
          <div className="space-y-2">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>เลือกช่วงเวลาที่สะดวก</p>
            <div className="flex gap-2">
              {currentProtocol.windows.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    haptics.light();
                    setSelectedWindowId(w.id);
                  }}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                    selectedWindowId === w.id 
                      ? 'bg-green-500 border-green-500 text-black' 
                      : isDark ? 'bg-white/[0.04] border-white/[0.06] text-zinc-400' : 'bg-black/[0.03] border-black/[0.06] text-zinc-500'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="pt-2 space-y-3 overflow-hidden"
            >
              <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
              <p className="text-xs font-bold uppercase tracking-widest text-green-500">คำแนะนำระหว่างอดอาหาร</p>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-3 text-xs">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                    <Droplets size={14} />
                  </div>
                  <p className={textMuted}>ดื่มน้ำเปล่าให้เพียงพอ ช่วยลดความหิวและรักษาสมดุลร่างกาย</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="w-8 h-8 rounded-lg bg-zinc-500/10 text-zinc-500 flex items-center justify-center flex-shrink-0">
                    <Coffee size={14} />
                  </div>
                  <p className={textMuted}>กาแฟดำหรือชาไม่ใส่น้ำตาล สามารถดื่มได้โดยไม่หลุด Fast</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0">
                    <Clock size={14} />
                  </div>
                  <p className={textMuted}>หากรู้สึกหิวมาก ให้ลองดื่มน้ำอุ่นหรือเบี่ยงเบนความสนใจด้วยกิจกรรมอื่น</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Main Timer Display */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative flex flex-col items-center justify-center py-12 bento-card overflow-hidden ${cardBg}`}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className={`w-[600px] h-[600px] rounded-full blur-[100px] animate-pulse ${isOvertime ? 'bg-yellow-500/20' : 'bg-gradient-to-tr from-green-500/20 to-teal-500/20'}`} style={{ animationDuration: '4s' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-[320px] aspect-square mb-2">
          <svg
            className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none drop-shadow-xl"
            viewBox="0 0 320 320"
          >
            {/* Background Ring */}
            <circle
              cx="160"
              cy="160"
              r={radius}
              fill="none"
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}
              strokeWidth={stroke}
            />
            {/* Progress Ring */}
            <circle
              cx="160"
              cy="160"
              r={radius}
              fill="none"
              stroke={isOvertime ? "url(#gradient-overtime)" : "url(#gradient)"}
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
            {/* Overtime Ring Glow effect */}
            {isOvertime && (
              <circle
                cx="160"
                cy="160"
                r={radius}
                fill="none"
                stroke="url(#gradient-overtime)"
                strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={0}
                strokeLinecap="round"
                className="opacity-40 blur-md animate-pulse"
              />
            )}
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22c55e" /> {/* green-500 */}
                <stop offset="100%" stopColor="#14b8a6" /> {/* teal-500 */}
              </linearGradient>
              <linearGradient id="gradient-overtime" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#eab308" /> {/* yellow-500 */}
                <stop offset="100%" stopColor="#f59e0b" /> {/* amber-500 */}
              </linearGradient>
            </defs>
          </svg>

          <div className="z-10 text-center space-y-3 px-4">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${
                isOvertime ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' : 'bg-green-500/10 text-green-500'
              } text-[10px] font-bold uppercase tracking-widest`}
            >
              <Timer size={12} />
              {activeSession ? (isOvertime ? 'Goal Achieved' : 'Fasting in Progress') : 'Ready to Start'}
            </div>
            
            <div className="space-y-1">
              <h2 className={`text-5xl sm:text-6xl font-mono font-bold tracking-tighter tabular-nums ${
                isOvertime ? 'text-yellow-600 dark:text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]' : textMain
              }`}>
                {formatTime(safeElapsed)}
              </h2>
              <p className={`${textMuted} text-xs font-medium`}>
                เป้าหมาย: {currentProtocol.fastHours} ชั่วโมง ({formatTime(targetSeconds)})
              </p>
            </div>
          </div>
        </div>

        <div className="z-10 flex flex-col items-center gap-4">
          {!activeSession ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startFast}
              className="flex items-center gap-3 bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold px-10 py-5 rounded-full transition-all shadow-xl shadow-green-500/20 ring-4 ring-green-500/20"
            >
              <Play size={24} fill="currentColor" />
              เริ่มอดอาหาร
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={stopFast}
              className={`flex items-center gap-3 ${
                isOvertime 
                  ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-yellow-500/20 ring-yellow-500/20' 
                  : 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-red-500/20 ring-red-500/20'
              } font-bold px-10 py-5 rounded-full transition-all shadow-xl ring-4`}
            >
              <Square size={20} fill="currentColor" />
              หยุดการทำ IF
            </motion.button>
          )}
          
          {activeSession && (
            <div className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
              isDark ? 'bg-white/[0.04] text-zinc-400' : 'bg-black/[0.03] text-zinc-500'
            }`}>
              <Clock size={12} />
              สิ้นสุดประมาณ {format(addHours(new Date(activeSession.startTime), currentProtocol.fastHours), 'HH:mm')} น.
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Dynamic Fasting States (Science-backed body state visualization) ── */}
      {activeSession && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <FastingStateTimeline
            elapsedHours={elapsed / 3600}
            totalHours={currentProtocol.fastHours}
            isDark={isDark}
          />
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${cardBg} p-4 bento-card space-y-2 relative overflow-hidden`}
        >
          <div className="absolute -right-4 -top-4 opacity-5 text-orange-500 pointer-events-none">
            <Flame size={80} />
          </div>
          <div className="flex items-center gap-2 text-orange-500 relative z-10">
            <Flame size={18} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Fat Burning</span>
          </div>
          <p className="text-3xl font-bold relative z-10">~{((safeElapsed / 3600) * 0.12).toFixed(2)} <span className="text-xs font-normal text-zinc-500">g</span></p>
          <p className={`text-[10px] font-medium ${textMuted} relative z-10`}>ประมาณการไขมันที่ถูกใช้</p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${cardBg} p-4 bento-card space-y-2 relative overflow-hidden`}
        >
          <div className="absolute -right-4 -top-4 opacity-5 text-blue-500 pointer-events-none">
            <History size={80} />
          </div>
          <div className="flex items-center gap-2 text-blue-500 relative z-10">
            <History size={18} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Streak</span>
          </div>
          <p className="text-3xl font-bold relative z-10">{history.length + (activeSession ? 1 : 0)} <span className="text-xs font-normal text-zinc-500">Days</span></p>
          <p className={`text-[10px] font-medium ${textMuted} relative z-10`}>ทำ IF อย่างต่อเนื่อง</p>
        </motion.div>
      </div>

      {/* ── IF Meal Recommendation Section ── */}
      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <UtensilsCrossed size={16} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">เมนูแนะนำ IF</h3>
              <p className={`text-[10px] ${textMuted}`}>เมนูง่ายๆ ประหยัดเวลา</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              haptics.light();
              setShowMealGuide(!showMealGuide);
            }}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              showMealGuide
                ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20'
                : isDark ? 'bg-white/[0.06] text-zinc-400 hover:bg-white/[0.1]' : 'bg-black/[0.04] text-zinc-500 hover:bg-black/[0.08]'
            }`}
          >
            {showMealGuide ? 'ซ่อน' : 'ดูเมนู'}
          </motion.button>
        </div>

        <AnimatePresence>
          {showMealGuide && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden space-y-4"
            >
              {/* Tips Banner */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`${cardBg} bento-card p-4`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap size={18} className="text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-400">💡 เคล็ดลับ Break Fast</p>
                    <p className={`text-[11px] leading-relaxed ${textMuted}`}>
                      มื้อแรกหลังอดอาหาร ควรเป็นของเบาท้อง เช่น โจ๊ก ข้าวต้ม หรือสลัด
                      หลีกเลี่ยงของมัน ของทอด ในมื้อแรก เพราะกระเพาะยังไม่พร้อม
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Category Tabs */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {MEAL_CATEGORIES.map((cat) => (
                  <motion.button
                    key={cat.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      haptics.light();
                      setSelectedMealCategory(cat.id);
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                      selectedMealCategory === cat.id
                        ? `${cat.bgColor} ${cat.color} border-current/20 shadow-lg`
                        : isDark
                          ? 'bg-white/[0.04] border-white/[0.06] text-zinc-500 hover:bg-white/[0.08]'
                          : 'bg-black/[0.03] border-black/[0.06] text-zinc-400 hover:bg-black/[0.06]'
                    }`}
                  >
                    {cat.icon}
                    {cat.label}
                  </motion.button>
                ))}
              </div>

              {/* Category Description */}
              {MEAL_CATEGORIES.filter(c => c.id === selectedMealCategory).map(cat => (
                <motion.p
                  key={cat.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`text-xs px-1 ${textMuted} flex items-center gap-2`}
                >
                  <ShoppingBag size={12} />
                  {cat.description}
                </motion.p>
              ))}

              {/* Meal Cards */}
              <div className="space-y-3">
                {MEAL_CATEGORIES.find(c => c.id === selectedMealCategory)?.meals.map((meal, idx) => (
                  <motion.div
                    key={meal.name}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.07, duration: 0.35 }}
                    className={`${cardBg} bento-card p-4 space-y-3`}
                  >
                    {/* Meal Header */}
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <p className="font-bold text-sm leading-snug">{meal.name}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400">
                            <Flame size={10} />
                            {meal.calories} kcal
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400">
                            <Egg size={10} />
                            {meal.protein}g โปรตีน
                          </span>
                          <span className={`text-[10px] font-medium ${textMuted}`}>
                            ⏱ {meal.prepTime}
                          </span>
                        </div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                        meal.calories <= 200 ? 'bg-green-500/10 text-green-400' :
                        meal.calories <= 350 ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {meal.calories <= 200 ? 'Low' : meal.calories <= 350 ? 'Med' : 'High'}
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {meal.tags.map(tag => (
                        <span
                          key={tag}
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                            isDark ? 'bg-white/[0.06] text-zinc-400' : 'bg-black/[0.04] text-zinc-500'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Tip */}
                    <div className={`flex items-start gap-2 p-2.5 rounded-xl ${
                      isDark ? 'bg-white/[0.03]' : 'bg-black/[0.02]'
                    }`}>
                      <Heart size={12} className="text-pink-400 flex-shrink-0 mt-0.5" />
                      <p className={`text-[11px] leading-relaxed ${textMuted}`}>{meal.tip}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Calorie Summary */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={`${cardBg} bento-card p-4`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Info size={16} className="text-green-400" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">คำแนะนำแคลอรี่</p>
                    <p className={`text-[11px] leading-relaxed ${textMuted}`}>
                      สำหรับ IF ควรกินประมาณ 1,400-1,800 kcal/วัน แบ่งเป็น 2-3 มื้อในช่วง Eating Window
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>


      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-bold text-lg">ประวัติการทำ IF</h3>
          <button 
            onClick={() => {
              haptics.light();
              setShowAllHistory(true);
            }}
            className="text-green-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1 hover:opacity-80 transition-opacity"
          >
            ดูทั้งหมด <ChevronRight size={14} />
          </button>
        </div>
        <div className="space-y-3">
          {history.map((s, idx) => (
            <motion.div 
              key={s.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`${cardBg} p-3.5 bento-card flex justify-between items-center`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-green-500/10' : 'bg-green-50'} text-green-500`}>
                  <Clock size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm">สูตร {s.protocol}</p>
                  <p className={`text-[10px] font-medium ${textMuted}`}>{format(new Date(s.startTime), 'd MMM yyyy • HH:mm')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-green-500">
                  {s.endTime ? formatTime(differenceInSeconds(new Date(s.endTime), new Date(s.startTime))) : '00:00:00'}
                </p>
                <div className="flex items-center justify-end gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <p className={`text-[10px] font-bold ${textMuted} uppercase tracking-tighter`}>Completed</p>
                </div>
              </div>
            </motion.div>
          ))}
          {history.length === 0 && (
            <div className={`text-center py-12 rounded-[1.75rem] border border-dashed ${isDark ? 'text-zinc-600 bg-white/[0.02] border-white/[0.06]' : 'text-zinc-400 bg-black/[0.02] border-black/[0.06]'}`}>
              <Timer size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">ยังไม่มีประวัติการทำ IF</p>
              <p className="text-xs opacity-60">เริ่มอดอาหารเพื่อบันทึกสถิติแรกของคุณ</p>
            </div>
          )}
        </div>
      </section>

      {/* History Modal */}
      <AnimatePresence>
        {showAllHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-xl"
          >
            <div className={`flex-1 overflow-y-auto ${isDark ? 'bg-zinc-950' : 'bg-white'}`}>
              <div className={`sticky top-0 z-10 px-5 py-4 border-b ${isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-white/80 border-zinc-200'} backdrop-blur-xl flex justify-between items-center`}>
                <h2 className="text-xl font-bold">ประวัติทั้งหมด</h2>
                <button 
                  onClick={() => {
                    haptics.light();
                    setShowAllHistory(false);
                  }}
                  className={`p-2 rounded-full ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center text-green-500">
                    <History size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold">สรุปสถิติ</h3>
                    <p className={`text-xs ${textMuted}`}>อ้างอิงจากข้อมูลที่บันทึกไว้</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className={`${cardBg} p-4 rounded-3xl border ${isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted} mb-1`}>Fasts Completed</p>
                    <p className="text-2xl font-bold">{fullHistory.length}</p>
                  </div>
                  <div className={`${cardBg} p-4 rounded-3xl border ${isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted} mb-1`}>Total Fasting Hours</p>
                    <p className="text-2xl font-bold">{Math.floor(fullHistory.reduce((acc, s) => acc + (s.endTime ? differenceInSeconds(new Date(s.endTime), new Date(s.startTime)) : 0), 0) / 3600)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {fullHistory.map((s, idx) => (
                    <motion.div 
                      key={s.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                      className={`${cardBg} p-4 rounded-3xl border ${isDark ? 'border-white/[0.06]' : 'border-black/[0.06]'} flex justify-between items-center`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-green-500/10' : 'bg-green-50'} text-green-500`}>
                          <Clock size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-sm">สูตร {s.protocol}</p>
                          <p className={`text-[10px] font-medium ${textMuted}`}>{format(new Date(s.startTime), 'd MMM yyyy • HH:mm')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-green-500">
                          {s.endTime ? formatTime(differenceInSeconds(new Date(s.endTime), new Date(s.startTime))) : '00:00:00'}
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <p className={`text-[9px] font-bold ${textMuted} uppercase tracking-tighter`}>Completed</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {fullHistory.length === 0 && (
                    <div className="text-center py-10 opacity-50">
                      <p className="text-sm">ไม่มีประวัติ</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
