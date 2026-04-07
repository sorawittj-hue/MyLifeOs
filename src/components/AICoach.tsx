import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import { db, type ChatMessage } from '../lib/db';
import { getAICoachResponse } from '../lib/gemini';
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

  useEffect(() => {
    let unsubscribe: () => void;

    if (firebaseUser) {
      unsubscribe = firebaseService.subscribeToCollection('chatMessages', firebaseUser.uid, (data) => {
        const msgs = (data as ChatMessage[]).sort((a, b) => a.timestamp - b.timestamp);
        if (msgs.length === 0) {
          const welcome: any = {
            role: 'model',
            content: "สวัสดี! ผมคือ AI Health Coach ของคุณ มีอะไรให้ผมช่วยดูแลสุขภาพของคุณในวันนี้ไหมครับ? ผมสามารถวิเคราะห์ข้อมูลของคุณ วางแผนการออกกำลังกาย หรือให้คำแนะนำด้านโภชนาการได้ครับ",
            timestamp: Date.now()
          };
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

  const loadMessages = async () => {
    const msgs = await db.chatMessages.orderBy('timestamp').toArray();
    if (msgs.length === 0) {
      const welcome: ChatMessage = {
        role: 'model',
        content: "สวัสดี! ผมคือ AI Health Coach ของคุณ มีอะไรให้ผมช่วยดูแลสุขภาพของคุณในวันนี้ไหมครับ? ผมสามารถวิเคราะห์ข้อมูลของคุณ วางแผนการออกกำลังกาย หรือให้คำแนะนำด้านโภชนาการได้ครับ",
        timestamp: Date.now()
      };
      await db.chatMessages.add(welcome);
      setMessages([welcome]);
    } else {
      setMessages(msgs);
    }
  };

  const sendMessage = async (overrideInput?: string | React.MouseEvent) => {
    const messageText = typeof overrideInput === 'string' ? overrideInput : input;
    if (!messageText.trim() || isLoading) return;

    const userMsg: any = {
      role: 'user',
      content: messageText,
      timestamp: Date.now()
    };

    if (!firebaseUser) {
      setMessages(prev => [...prev, userMsg as ChatMessage]);
    }
    setInput('');
    setIsLoading(true);

    try {
      if (firebaseUser) {
        await firebaseService.addToCollection('chatMessages', userMsg);
      } else {
        await db.chatMessages.add(userMsg as ChatMessage);
      }
      
      // Gather context for AI
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

      const context = {
        user,
        todayFood: foodLogs,
        recentWeight: bodyMetrics,
        recentVitals: vitals,
      };

      const response = await getAICoachResponse(messageText, context);
      
      const aiMsg: any = {
        role: 'model',
        content: response,
        timestamp: Date.now()
      };

      if (firebaseUser) {
        await firebaseService.addToCollection('chatMessages', aiMsg);
      } else {
        await db.chatMessages.add(aiMsg as ChatMessage);
        setMessages(prev => [...prev, aiMsg as ChatMessage]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const headerBg = theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white/80 border-zinc-200';
  const chatBg = theme === 'dark' ? 'bg-black' : 'bg-zinc-50';
  const inputContainerBg = theme === 'dark' ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-zinc-200';
  const inputBg = theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100';
  const textMuted = theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400';

  return (
    <div className={`flex flex-col h-[calc(100vh-80px)] ${chatBg}`}>
      <header className={`p-4 border-b backdrop-blur-md flex items-center gap-3 ${headerBg}`}>
        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-black">
          <Bot size={24} />
        </div>
        <div>
          <h1 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-zinc-900'}`}>โค้ชสุขภาพ AI</h1>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>ออนไลน์ • Gemini Flash</span>
          </div>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'user' ? (theme === 'dark' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-500') : 'bg-green-500/10 text-green-500'
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-green-500 text-black font-medium rounded-tr-none' 
                    : `${theme === 'dark' ? 'bg-zinc-900 text-zinc-200 border-zinc-800' : 'bg-white text-zinc-800 border-zinc-200'} border rounded-tl-none`
                }`}>
                  <div className={`prose prose-sm max-w-none ${theme === 'dark' ? 'prose-invert' : ''}`}>
                    <ReactMarkdown>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                <Loader2 size={16} className="animate-spin" />
              </div>
              <div className={`p-4 rounded-2xl border rounded-tl-none ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className={`p-4 border-t pb-24 ${inputContainerBg}`}>
        <div className="relative">
          <input 
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="ถามอะไรก็ได้เกี่ยวกับสุขภาพของคุณ..."
            className={`w-full border-none rounded-2xl py-4 pl-4 pr-14 outline-none focus:ring-2 focus:ring-green-500 ${inputBg} ${theme === 'dark' ? 'text-white placeholder:text-zinc-500' : 'text-zinc-900 placeholder:text-zinc-400'}`}
          />
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 bottom-2 w-10 bg-green-500 rounded-xl flex items-center justify-center text-black disabled:opacity-50 disabled:bg-zinc-700 transition-all"
          >
            <Send size={18} />
          </motion.button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { q: "วิเคราะห์สุขภาพของฉันวันนี้", label: "วิเคราะห์สุขภาพวันนี้" },
            { q: "วางแผนการออกกำลังกายให้หน่อย", label: "วางแผนออกกำลังกาย" },
            { q: "วันนี้ควรทานอะไรดี?", label: "ควรทานอะไรดี?" },
            { q: "ทำไมน้ำหนักไม่ลด?", label: "ทำไมน้ำหนักไม่ลด?" }
          ].map((item) => (
            <motion.button 
              key={item.q}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => sendMessage(item.q)}
              className={`whitespace-nowrap border px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                theme === 'dark' 
                  ? 'bg-zinc-800/50 border-zinc-800 text-zinc-400 hover:bg-zinc-800' 
                  : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200'
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
