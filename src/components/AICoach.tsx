import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Zap } from 'lucide-react';
import { db, type ChatMessage, withSyncMeta } from '../lib/db';
import { getAICoachResponse, type AICoachContext } from '../lib/gemini';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../lib/store';
import { firebaseService } from '../lib/firebaseService';

export default function AICoach() {
  const { theme, user, firebaseUser } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    let unsubscribe: () => void;

    if (firebaseUser) {
      unsubscribe = firebaseService.subscribeToCollection('chatMessages', firebaseUser.uid, (data) => {
        const msgs = (data as ChatMessage[]).sort((a, b) => a.timestamp - b.timestamp);
        if (msgs.length === 0) {
          const welcome: ChatMessage = withSyncMeta({
            role: 'model',
            content: "สวัสดี! ผมคือ AI Health Coach ของคุณ มีอะไรให้ผมช่วยดูแลสุขภาพของคุณในวันนี้ไหมครับ? ผมสามารถวิเคราะห์ข้อมูลของคุณ วางแผนการออกกำลังกาย หรือให้คำแนะนำด้านโภชนาการได้ครับ",
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
  }, [firebaseUser]);

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
        content: "สวัสดี! ผมคือ AI Health Coach ของคุณ มีอะไรให้ผมช่วยดูแลสุขภาพของคุณในวันนี้ไหมครับ? ผมสามารถวิเคราะห์ข้อมูลของคุณ วางแผนการออกกำลังกาย หรือให้คำแนะนำด้านโภชนาการได้ครับ",
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

      if (firebaseUser) {
        foodLogs = (await firebaseService.getCollection('foodLogs', firebaseUser.uid) as any[]).filter(f => f.date === today);
        bodyMetrics = (await firebaseService.getCollection('bodyMetrics', firebaseUser.uid) as any[]).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
        vitals = (await firebaseService.getCollection('vitals', firebaseUser.uid) as any[]).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
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

  return (
    <div className={`flex flex-col h-[calc(100vh-80px)] ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#f5f5f7]'}`}>
      {/* Premium Header */}
      <header className={`p-4 flex items-center gap-3 relative ${
        isDark ? 'bg-[#0a0a0a]/80 border-b border-white/[0.04]' : 'bg-white/80 border-b border-black/[0.04]'
      }`}
        style={{ backdropFilter: 'blur(24px) saturate(180%)' }}
      >
        <div className="relative">
          <div className={`w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center text-black shadow-lg shadow-green-500/20`}>
            <Bot size={20} />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0a0a0a] animate-pulse" />
        </div>
        <div>
          <h1 className="font-bold text-sm">โค้ชสุขภาพ AI</h1>
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-semibold uppercase tracking-wider ${textMuted}`}>ออนไลน์ • Gemini Flash</span>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'user' 
                    ? (isDark ? 'bg-white/[0.06]' : 'bg-black/[0.04]') 
                    : 'bg-gradient-to-br from-green-400/20 to-emerald-500/20'
                }`}>
                  {msg.role === 'user' 
                    ? <User size={13} className={isDark ? 'text-zinc-400' : 'text-zinc-500'} /> 
                    : <Sparkles size={13} className={isDark ? 'text-green-400' : 'text-green-500'} />
                  }
                </div>
                <div className={`p-3.5 text-[13px] leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-500 text-black font-medium rounded-2xl rounded-tr-md shadow-lg shadow-green-500/10' 
                    : `${isDark ? 'glass-card text-zinc-200' : 'glass-card-light text-zinc-700'} rounded-2xl rounded-tl-md`
                }`}>
                  <div className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''} ${msg.role === 'user' ? 'prose-p:text-black prose-strong:text-black prose-li:text-black' : ''}`}>
                    <ReactMarkdown>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Typing Indicator */}
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-400/20 to-emerald-500/20 flex items-center justify-center">
                <Loader2 size={13} className="text-green-400 animate-spin" />
              </div>
              <div className={`p-3.5 rounded-2xl rounded-tl-md ${isDark ? 'glass-card' : 'glass-card-light'}`}>
                <div className="flex gap-1.5 items-center">
                  <motion.div 
                    className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-zinc-500' : 'bg-zinc-400'}`}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div 
                    className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-zinc-500' : 'bg-zinc-400'}`}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                  />
                  <motion.div 
                    className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-zinc-500' : 'bg-zinc-400'}`}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className={`p-4 pb-28 ${
        isDark ? 'bg-[#0a0a0a]/80 border-t border-white/[0.04]' : 'bg-white/80 border-t border-black/[0.04]'
      }`}
        style={{ backdropFilter: 'blur(24px) saturate(180%)' }}
      >
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
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 top-1.5 bottom-1.5 w-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center text-black disabled:opacity-30 disabled:from-zinc-700 disabled:to-zinc-700 transition-all shadow-lg shadow-green-500/10"
          >
            <Send size={16} />
          </motion.button>
        </div>
        
        {/* Quick prompts */}
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { q: "วิเคราะห์สุขภาพของฉันวันนี้", label: "วิเคราะห์สุขภาพ" },
            { q: "วางแผนการออกกำลังกายให้หน่อย", label: "วางแผนออกกำลัง" },
            { q: "วันนี้ควรทานอะไรดี?", label: "แนะนำอาหาร" },
            { q: "ทำไมน้ำหนักไม่ลด?", label: "ทำไมน้ำหนักไม่ลด" }
          ].map((item) => (
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
