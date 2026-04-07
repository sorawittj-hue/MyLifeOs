import React, { useState, useEffect } from 'react';
import { Play, Square, Timer, Flame, History, ChevronRight, Info, Coffee, Droplets, Moon, Sun, Clock } from 'lucide-react';
import { db, type FastingSession } from '../lib/db';
import { haptics } from '../lib/haptics';
import { format, differenceInSeconds, addHours, setHours, setMinutes, isAfter, isBefore } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../lib/store';
import { firebaseService } from '../lib/firebaseService';

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

export default function FastingTracker() {
  const { theme, firebaseUser } = useAppStore();
  const isDark = theme === 'dark';
  const [activeSession, setActiveSession] = useState<FastingSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedProtocolId, setSelectedProtocolId] = useState('16:8');
  const [selectedWindowId, setSelectedWindowId] = useState('16-std');
  const [history, setHistory] = useState<FastingSession[]>([]);
  const [showInfo, setShowInfo] = useState(true);

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
        const completed = data.filter(s => s.completed === 1).sort((a, b) => (b.endTime || 0) - (a.endTime || 0)).slice(0, 10);
        
        if (active) {
          setActiveSession(active);
          setElapsed(differenceInSeconds(new Date(), new Date(active.startTime)));
          setSelectedProtocolId(active.protocol);
        } else {
          setActiveSession(null);
          setElapsed(0);
        }
        setHistory(completed);
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
    const sessions = await db.fastingSessions.where('completed').equals(1).reverse().limit(10).toArray();
    setHistory(sessions);
  };

  const startFast = async () => {
    haptics.medium();
    const newSession: any = {
      startTime: Date.now(),
      protocol: selectedProtocolId,
      completed: 0,
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
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const targetSeconds = currentProtocol.fastHours * 3600;
  const progress = Math.min((elapsed / targetSeconds) * 100, 100);

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
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
           <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="w-[500px] h-[500px] rounded-full border-[20px] border-green-500 border-dashed" 
           />
        </div>

        <div className="z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-widest">
            <Timer size={12} />
            {activeSession ? 'Fasting in Progress' : 'Ready to Start'}
          </div>
          
          <div className="space-y-1">
            <h2 className={`text-7xl font-mono font-bold tracking-tighter ${textMain}`}>
              {formatTime(elapsed)}
            </h2>
            <p className={`${textMuted} text-xs font-medium`}>
              เป้าหมาย: {currentProtocol.fastHours} ชั่วโมง ({formatTime(targetSeconds)})
            </p>
          </div>
        </div>

        <div className="mt-10 z-10 flex flex-col items-center gap-4">
          {!activeSession ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startFast}
              className="flex items-center gap-3 bg-green-500 hover:bg-green-600 text-black font-bold px-10 py-5 rounded-[24px] transition-all shadow-xl shadow-green-500/20"
            >
              <Play size={24} fill="currentColor" />
              เริ่มอดอาหาร
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={stopFast}
              className="flex items-center gap-3 bg-red-500 hover:bg-red-600 text-white font-bold px-10 py-5 rounded-[24px] transition-all shadow-xl shadow-red-500/20"
            >
              <Square size={20} fill="currentColor" />
              หยุดอดอาหาร
            </motion.button>
          )}
          
          {activeSession && (
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              สิ้นสุดประมาณ: {format(addHours(new Date(activeSession.startTime), currentProtocol.fastHours), 'HH:mm')} น.
            </p>
          )}
        </div>

        {activeSession && (
          <div className="mt-10 w-full px-10 space-y-3">
            <div className={`flex justify-between text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>
              <span>ความคืบหน้า</span>
              <span className="text-green-500">{Math.round(progress)}%</span>
            </div>
            <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500" 
              />
            </div>
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${cardBg} p-4 bento-card space-y-2`}
        >
          <div className="flex items-center gap-2 text-orange-500">
            <Flame size={18} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Fat Burning</span>
          </div>
          <p className="text-2xl font-bold">~{((elapsed / 3600) * 0.12).toFixed(2)} <span className="text-xs font-normal text-zinc-500">g</span></p>
          <p className={`text-[10px] font-medium ${textMuted}`}>ประมาณการไขมันที่ถูกใช้</p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`${cardBg} p-5 rounded-3xl border space-y-2 shadow-sm`}
        >
          <div className="flex items-center gap-2 text-blue-500">
            <History size={18} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Streak</span>
          </div>
          <p className="text-2xl font-bold">{history.length + (activeSession ? 1 : 0)} <span className="text-xs font-normal text-zinc-500">Days</span></p>
          <p className={`text-[10px] font-medium ${textMuted}`}>ทำ IF อย่างต่อเนื่อง</p>
        </motion.div>
      </div>

      <section className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-bold text-lg">ประวัติการทำ IF</h3>
          <button className="text-green-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
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
    </div>
  );
}
