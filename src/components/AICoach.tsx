import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Zap, Brain, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { db, type ChatMessage, withSyncMeta } from '../lib/db';
import { getAICoachResponse, type AICoachContext } from '../lib/gemini';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../lib/store';
import { firebaseService } from '../lib/firebaseService';

export default function AICoach() {
  const { theme, user, firebaseUser, dailyMetrics } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  // Build greeting that reflects recovery status
  const buildWelcomeMessage = (): string => {
    if (!dailyMetrics?.recovery) {
      return 'สวัสดี! ผมคือ AI Health Coach ผ่าน MiniMax AI 🤖\n\nผมสามารถวิเคราะห์ Recovery/Strain ของคุณ วางแผนการออกกำลังกาย และให้คำแนะนำโภชนาการได้ครับ';
    }
    const r = dailyMetrics.recovery;
    const s = dailyMetrics.strain;
    if (r.score < 34) {
      return `⚠️ Recovery ของคุณวันนี้อยู่ที่ **${r.score}%** — ต่ำมาก\n\nผมแนะนำให้พักผ่อน หลีกเลี่ยงการออกกำลังกายหนัก และโฟกัสการนอนให้ดีขึ้นครับ มีอะไรให้ผมช่วยวิเคราะห์เพิ่มไหม?`;
    }
    if (r.score >= 67) {
      return `💚 Recovery สูงมาก **${r.score}%** — ร่างกายพร้อมเต็มที่!\n\nStrain วันนี้ **${s?.score ?? 0}/21** (${s?.zoneTh ?? '--'}) มีอะไรให้ผมช่วยวางแผนการออกกำลังกายหรือเมนูอาหารวันนี้ไหมครับ?`;
    }
    return `👋 สวัสดี! Recovery วันนี้ **${r.score}%** (${r.labelTh}) Strain **${s?.score ?? 0}/21**\n\nผมพร้อมช่วยออกแบบโปรแกรมที่เหมาะกับร่างกายของคุณวันนี้ครับ!`;
  };

  useEffect(() => {
    let unsubscribe: () => void;

    if (firebaseUser) {
      unsubscribe = firebaseService.subscribeToCollection<ChatMessage>('chatMessages', firebaseUser.uid, (data) => {
        const msgs = (data as ChatMessage[]).sort((a, b) => a.timestamp - b.timestamp);
        if (msgs.length === 0) {
          const welcome: ChatMessage = withSyncMeta({
            role: 'model',
            content: buildWelcomeMessage(),
            timestamp: Date.now()
          }) as ChatMessage;
          firebaseService.addToCollection('chatMessages', welcome);
        } else {
          setMessages(msgs);
        }
      });
    } else {
      loadMessages();
    }

    return () => unsubscribe?.();
  }, [firebaseUser, dailyMetrics?.recovery?.score]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const loadMessages = async () => {
    const msgs = await db.chatMessages.orderBy('timestamp').toArray();
    if (msgs.length === 0) {
      const welcome: ChatMessage = withSyncMeta({
        role: 'model',
        content: buildWelcomeMessage(),
        timestamp: Date.now()
      }) as ChatMessage;
      await db.chatMessages.add(welcome);
      setMessages([welcome]);
    } else {
      setMessages(msgs);
    }
  };

  const sendMessage = async (overrideInput?: string | React.MouseEvent) => {
    const messageText = typeof overrideInput === 'string' ? overrideInput : input;
    if (!messageText.trim() || isLoading) return;

    const userMsg: ChatMessage = withSyncMeta({
      role: 'user',
      content: messageText,
      timestamp: Date.now()
    }) as ChatMessage;

    if (!firebaseUser) {
      setMessages(prev => [...prev, userMsg]);
    }
    setInput('');
    setIsLoading(true);

    try {
      if (firebaseUser) {
        await firebaseService.addToCollection('chatMessages', userMsg);
      } else {
        await db.chatMessages.add(userMsg);
      }

      const today = new Date().toISOString().split('T')[0];
      let foodLogs: any[] = [];
      let bodyMetrics: any[] = [];
      let vitals: any[] = [];
      let recentJournals: any[] = [];

      if (firebaseUser) {
        foodLogs = (await firebaseService.getCollection('foodLogs', firebaseUser.uid) as any[]).filter(f => f.date === today);
        bodyMetrics = (await firebaseService.getCollection('bodyMetrics', firebaseUser.uid) as any[]).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
        vitals = (await firebaseService.getCollection('vitals', firebaseUser.uid) as any[]).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
        recentJournals = (await firebaseService.getCollection('dailyJournals', firebaseUser.uid) as any[]).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
      } else {
        foodLogs = await db.foodLogs.where('date').equals(today).toArray();
        bodyMetrics = await db.bodyMetrics.reverse().limit(5).toArray();
        vitals = await db.vitals.reverse().limit(5).toArray();
      }

      const context: AICoachContext = {
        user,
        todayFood: foodLogs,
        recentWeight: bodyMetrics,
        recentVitals: vitals,
        // Inject recovery/strain for smart coaching
        recovery: dailyMetrics?.recovery ?? null,
        strain: dailyMetrics?.strain ?? null,
        tomorrowReadiness: dailyMetrics?.tomorrowReadiness ?? null,
        recentJournals,
        habitCorrelations: dailyMetrics?.habitCorrelations ?? [],
      };

      const response = await getAICoachResponse(messageText, context);

      const aiMsg: ChatMessage = withSyncMeta({
        role: 'model',
        content: response,
        timestamp: Date.now()
      }) as ChatMessage;

      if (firebaseUser) {
        await firebaseService.addToCollection('chatMessages', aiMsg);
      } else {
        await db.chatMessages.add(aiMsg);
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const textMuted = isDark ? 'text-zinc-500' : 'text-zinc-400';

  // Dynamic quick prompts based on recovery score
  const getQuickPrompts = () => {
    const score = dailyMetrics?.recovery?.score ?? 50;
    const strain = dailyMetrics?.strain?.score ?? 5;
    const base = [
      { q: `วิเคราะห์ Recovery ${score}% ของฉัน`, label: `วิเคราะห์ Recovery` },
      { q: 'ควรออกกำลังกายหนักแค่ไหนวันนี้?', label: 'Workout Level วันนี้' },
    ];
    if (score < 40) {
      base.push({ q: 'ทำอย่างไรให้ Recovery ดีขึ้น?', label: 'เพิ่ม Recovery' });
    } else if (score >= 70 && strain < 10) {
      base.push({ q: 'ออกแบบโปรแกรม HIIT สำหรับวันนี้หน่อย', label: 'โปรแกรม HIIT' });
    } else {
      base.push({ q: 'วางแผนการออกกำลังกายให้หน่อย', label: 'วางแผนออกกำลัง' });
    }
    base.push({ q: 'วันนี้ควรทานอะไรดี?', label: 'แนะนำอาหาร' });
    return base;
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-80px)] ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f5f5f7]'}`}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className={`p-4 flex items-center gap-3 relative ${
        isDark ? 'bg-[#0a0a0a]/80 border-b border-white/[0.04]' : 'bg-white/80 border-b border-black/[0.04]'
      }`} style={{ backdropFilter: 'blur(24px) saturate(180%)' }}>
        <div className="relative">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
            <Brain size={20} />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0a0a0a] animate-pulse" />
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-sm">โค้ชสุขภาพ AI</h1>
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-semibold uppercase tracking-wider ${textMuted}`}>Online • MiniMax AI</span>
          </div>
        </div>

        {/* Recovery badge in header */}
        {dailyMetrics?.recovery && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2"
          >
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black"
              style={{
                backgroundColor: `${dailyMetrics.recovery.color}15`,
                color: dailyMetrics.recovery.color,
                border: `1px solid ${dailyMetrics.recovery.color}30`
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dailyMetrics.recovery.color }} />
              R: {dailyMetrics.recovery.score}%
            </div>
            {dailyMetrics.strain && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black"
                style={{
                  backgroundColor: `${dailyMetrics.strain.color}15`,
                  color: dailyMetrics.strain.color,
                  border: `1px solid ${dailyMetrics.strain.color}30`
                }}
              >
                <Activity size={10} />
                S: {dailyMetrics.strain.score}
              </div>
            )}
          </motion.div>
        )}
      </header>

      {/* ── Chat Area ──────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[88%] flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'user'
                    ? (isDark ? 'bg-white/[0.06]' : 'bg-black/[0.04]')
                    : 'bg-gradient-to-br from-violet-400/20 to-blue-500/20'
                }`}>
                  {msg.role === 'user'
                    ? <User size={13} className={isDark ? 'text-zinc-400' : 'text-zinc-500'} />
                    : <Sparkles size={13} className={isDark ? 'text-violet-400' : 'text-violet-500'} />
                  }
                </div>
                <div className={`p-3.5 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-violet-500 to-blue-500 text-white font-medium rounded-2xl rounded-tr-md shadow-lg shadow-violet-500/10'
                    : `${isDark ? 'glass-card text-zinc-200' : 'glass-card-light text-zinc-700'} rounded-2xl rounded-tl-md`
                }`}>
                  <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''} ${msg.role === 'user' ? 'prose-p:text-white prose-strong:text-white prose-li:text-white' : ''}`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400/20 to-blue-500/20 flex items-center justify-center">
                <Loader2 size={13} className="text-violet-400 animate-spin" />
              </div>
              <div className={`p-3.5 rounded-2xl rounded-tl-md ${isDark ? 'glass-card' : 'glass-card-light'}`}>
                <div className="flex gap-1.5 items-center">
                  {[0, 0.15, 0.3].map((delay, i) => (
                    <motion.div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-zinc-500' : 'bg-zinc-400'}`}
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Input Area ─────────────────────────────────────────── */}
      <div className={`p-4 pb-28 ${
        isDark ? 'bg-[#0a0a0a]/80 border-t border-white/[0.04]' : 'bg-white/80 border-t border-black/[0.04]'
      }`} style={{ backdropFilter: 'blur(24px) saturate(180%)' }}>
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="ถามอะไรก็ได้เกี่ยวกับสุขภาพ..."
            className={`w-full rounded-2xl py-3.5 pl-4 pr-14 outline-none text-sm ${
              isDark
                ? 'input-premium text-white placeholder:text-zinc-600'
                : 'input-premium-light text-zinc-900 placeholder:text-zinc-400'
            }`}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 top-1.5 bottom-1.5 w-10 bg-gradient-to-br from-violet-500 to-blue-500 rounded-xl flex items-center justify-center text-white disabled:opacity-30 disabled:from-zinc-700 disabled:to-zinc-700 transition-all shadow-lg shadow-violet-500/10"
          >
            <Send size={16} />
          </motion.button>
        </div>

        {/* Dynamic quick prompts */}
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {getQuickPrompts().map((item) => (
            <motion.button
              key={item.q}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => sendMessage(item.q)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all ${
                isDark
                  ? 'bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-300'
                  : 'bg-black/[0.03] border border-black/[0.04] text-zinc-500 hover:bg-black/[0.05]'
              }`}
            >
              {item.label}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
