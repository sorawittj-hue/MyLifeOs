/**
 * ── Dynamic Fasting States: Science-Backed Body State Visualization ──
 * 
 * Shows real-time body states during a fast based on hours elapsed.
 * Based on published research on fasting physiology.
 */

import React from 'react';
import { motion } from 'motion/react';
import { Zap, Flame, Brain, Shield, Sparkles, HeartPulse, Dna, Leaf } from 'lucide-react';

export interface FastingState {
  id: string;
  name: string;
  nameTh: string;
  startHour: number;
  endHour: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  glowColor: string;
  description: string;
  scienceNote: string;
}

export const FASTING_STATES: FastingState[] = [
  {
    id: 'fed',
    name: 'Fed State',
    nameTh: 'สถานะร่างกายปกติ',
    startHour: 0,
    endHour: 4,
    icon: <Zap size={20} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    glowColor: 'shadow-blue-500/20',
    description: 'ร่างกายกำลังย่อยอาหาร อินซูลินยังสูง ใช้พลังงานจากกลูโคส',
    scienceNote: 'อินซูลินจะเพิ่มสูงขึ้นหลังรับประทานอาหาร ร่างกายจะใช้กลูโคสเป็นพลังงานหลัก',
  },
  {
    id: 'early_fasting',
    name: 'Early Fasting',
    nameTh: 'เริ่มเข้าสู่ช่วงอด',
    startHour: 4,
    endHour: 8,
    icon: <HeartPulse size={20} />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    glowColor: 'shadow-cyan-500/20',
    description: 'อินซูลินเริ่มลดลง ร่างกายเริ่มใช้ไกลโคเจน (แป้งสำรอง) จากตับ',
    scienceNote: 'ระดับอินซูลินลดลงอย่างมีนัยสำคัญ ร่างกายเริ่มเปลี่ยนจากโหมดเก็บพลังงานเป็นโหมดใช้พลังงาน',
  },
  {
    id: 'blood_sugar_drop',
    name: 'Blood Sugar Stabilization',
    nameTh: 'น้ำตาลในเลือดคงที่',
    startHour: 8,
    endHour: 12,
    icon: <Leaf size={20} />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    glowColor: 'shadow-green-500/20',
    description: 'น้ำตาลในเลือดลดลงสู่ระดับคงที่ ไกลโคเจนในตับเริ่มหมด ร่างกายเตรียมเปลี่ยนมาใช้ไขมัน',
    scienceNote: 'ระดับน้ำตาลในเลือดจะลดลงเหลือราว 70-90 mg/dL เป็นสัญญาณให้ร่างกายเริ่มสลายไขมัน',
  },
  {
    id: 'fat_burning',
    name: 'Fat Burning Zone',
    nameTh: 'โซนเผาผลาญไขมัน',
    startHour: 12,
    endHour: 16,
    icon: <Flame size={20} />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    glowColor: 'shadow-orange-500/20',
    description: 'ร่างกายเข้าสู่โหมดเผาผลาญไขมันอย่างเต็มที่! กรดไขมันถูกปล่อยจากเซลล์ไขมัน',
    scienceNote: 'Lipolysis เพิ่มขึ้นอย่างมาก ไขมันถูกเปลี่ยนเป็น Free Fatty Acids ส่งไปใช้เป็นพลังงานทั่วร่างกาย',
  },
  {
    id: 'ketosis',
    name: 'Ketosis',
    nameTh: 'คีโตซิส — เผาผลาญไขมันขั้นสูง',
    startHour: 16,
    endHour: 24,
    icon: <Sparkles size={20} />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    glowColor: 'shadow-purple-500/20',
    description: 'ตับเริ่มผลิตคีโตน (Ketone Bodies) สมองเริ่มใช้คีโตนเป็นเชื้อเพลิงแทนกลูโคส',
    scienceNote: 'Beta-hydroxybutyrate (BHB) คีโตนหลักที่ตับผลิต เป็นแหล่งพลังงานที่มีประสิทธิภาพสูงสำหรับสมอง',
  },
  {
    id: 'autophagy',
    name: 'Autophagy',
    nameTh: 'ออโตฟาจี — ซ่อมแซมเซลล์',
    startHour: 24,
    endHour: 48,
    icon: <Dna size={20} />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    glowColor: 'shadow-emerald-500/20',
    description: 'ร่างกายเริ่มกระบวนการออโตฟาจี: รีไซเคิลเซลล์เสีย สร้างเซลล์ใหม่ ชะลอความแก่',
    scienceNote: 'Autophagy ได้รับรางวัลโนเบลสาขาสรีรวิทยาปี 2016 เป็นกระบวนการที่ร่างกายทำลายส่วนประกอบเซลล์ที่เสียหายแล้วนำกลับมาใช้ใหม่',
  },
  {
    id: 'growth_hormone',
    name: 'Growth Hormone Surge',
    nameTh: 'โกรทฮอร์โมนพุ่งสูง',
    startHour: 24,
    endHour: 72,
    icon: <Shield size={20} />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    glowColor: 'shadow-yellow-500/20',
    description: 'ฮอร์โมน HGH เพิ่มขึ้นสูงถึง 5 เท่า ช่วยรักษามวลกล้ามเนื้อ เร่งการเผาผลาญไขมัน',
    scienceNote: 'งานวิจัยพบว่า HGH เพิ่มขึ้น 300-500% หลังอดอาหาร 24+ ชั่วโมง ช่วยป้องกันการสูญเสียกล้ามเนื้อ',
  },
  {
    id: 'deep_ketosis',
    name: 'Deep Ketosis',
    nameTh: 'คีโตซิสระดับลึก',
    startHour: 48,
    endHour: 72,
    icon: <Brain size={20} />,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    glowColor: 'shadow-indigo-500/20',
    description: 'สมองใช้คีโตนเป็นหลัก สติปัญญาแจ่มใส ลดการอักเสบทั่วร่างกาย',
    scienceNote: 'ระดับคีโตนในเลือดสูงกว่า 1.5 mmol/L สมองใช้คีโตนถึง 70% ของพลังงานทั้งหมด',
  },
];

// ── FastingStateTimeline Component ───────────────────────────
interface FastingStateTimelineProps {
  elapsedHours: number;
  totalHours: number;
  isDark: boolean;
}

export function FastingStateTimeline({ elapsedHours, totalHours, isDark }: FastingStateTimelineProps) {
  // Filter to relevant states based on total protocol hours (don't show 48h states in 16:8)
  const relevantStates = FASTING_STATES.filter(s => s.startHour < totalHours + 4);

  const getCurrentState = (): FastingState | null => {
    // Find the most specific state for current elapsed time
    const activeStates = FASTING_STATES.filter(
      s => elapsedHours >= s.startHour && elapsedHours < s.endHour
    );
    return activeStates[activeStates.length - 1] || null;
  };

  const currentState = getCurrentState();

  return (
    <div className="space-y-4">
      {/* Current State Highlight */}
      {currentState && (
        <motion.div
          key={currentState.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={`relative p-5 rounded-3xl border overflow-hidden ${
            isDark 
              ? 'glass-card border-white/[0.06]'
              : 'glass-card-light border-black/[0.06]'
          }`}
        >
          {/* Ambient glow */}
          <div className={`absolute inset-0 ${currentState.bgColor} opacity-30 blur-3xl`} />
          
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className={`w-12 h-12 rounded-2xl ${currentState.bgColor} flex items-center justify-center ${currentState.color}`}
              >
                {currentState.icon}
              </motion.div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">{currentState.name}</h3>
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${currentState.bgColor} ${currentState.color}`}>
                    Active
                  </span>
                </div>
                <p className={`text-xs font-medium ${currentState.color}`}>{currentState.nameTh}</p>
              </div>
            </div>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              {currentState.description}
            </p>
            <div className={`text-[10px] p-3 rounded-xl ${isDark ? 'bg-white/[0.03]' : 'bg-black/[0.02]'}`}>
              <span className={`font-bold ${currentState.color}`}>📚 วิทยาศาสตร์: </span>
              <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>{currentState.scienceNote}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Timeline */}
      <div className="space-y-1">
        <p className={`text-[10px] font-bold uppercase tracking-widest px-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          สถานะร่างกายตามเวลา
        </p>
        <div className="space-y-2">
          {relevantStates.map((state, idx) => {
            const isActive = currentState?.id === state.id;
            const isPast = elapsedHours >= state.endHour;
            const progress = isActive 
              ? Math.min(((elapsedHours - state.startHour) / (state.endHour - state.startHour)) * 100, 100)
              : isPast ? 100 : 0;

            return (
              <motion.div
                key={state.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
                  isActive 
                    ? `${isDark ? 'bg-white/[0.04]' : 'bg-black/[0.03]'} ring-1 ${isDark ? 'ring-white/[0.08]' : 'ring-black/[0.06]'}`
                    : ''
                }`}
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-3 h-3 rounded-full transition-all duration-500 ${
                    isActive 
                      ? `${state.bgColor} ring-2 ring-current ${state.color} animate-pulse-ring`
                      : isPast
                        ? `bg-green-500`
                        : isDark ? 'bg-zinc-800 ring-1 ring-zinc-700' : 'bg-zinc-200 ring-1 ring-zinc-300'
                  }`} />
                  {idx < relevantStates.length - 1 && (
                    <div className={`w-0.5 h-6 ${isPast ? 'bg-green-500/30' : isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-bold truncate ${
                      isActive ? state.color : isPast ? (isDark ? 'text-zinc-400' : 'text-zinc-500') : isDark ? 'text-zinc-600' : 'text-zinc-400'
                    }`}>
                      {state.nameTh.split('—')[0].trim()}
                    </p>
                    <span className={`text-[9px] ml-2 font-mono font-bold flex-shrink-0 ${
                      isActive ? state.color : isDark ? 'text-zinc-600' : 'text-zinc-400'
                    }`}>
                      {state.startHour}h → {state.endHour}h
                    </span>
                  </div>
                  {/* Progress bar */}
                  {(isActive || isPast) && (
                    <div className={`mt-1.5 h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`}>
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${
                          isPast && !isActive ? 'bg-green-500' : `bg-gradient-to-r from-green-500 to-emerald-400`
                        }`}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
