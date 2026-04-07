import React, { useEffect } from 'react';
import { Home, Timer, Utensils, Dumbbell, BarChart3, Bot, Settings, CheckSquare, Moon, User } from 'lucide-react';
import { useAppStore } from './lib/store';
import { haptics } from './lib/haptics';
import Dashboard from './components/Dashboard';
import FastingTracker from './components/FastingTracker';
import CalorieTracker from './components/CalorieTracker';
import WorkoutTracker from './components/WorkoutTracker';
import BodyMetrics from './components/BodyMetrics';
import HabitTracker from './components/HabitTracker';
import SleepTracker from './components/SleepTracker';
import AICoach from './components/AICoach';
import SettingsScreen from './components/Settings';
import Profile from './components/Profile';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const { activeTab, setActiveTab, isLoaded, loadUser, theme } = useAppStore();

  useEffect(() => {
    loadUser();
  }, []);

  if (!isLoaded) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-black' : 'bg-zinc-50'}`}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          className="text-green-500 font-bold text-3xl tracking-tighter"
        >
          LifeOS
        </motion.div>
      </div>
    );
  }

  const renderContent = () => {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {(() => {
            switch (activeTab) {
              case 'dashboard': return <Dashboard />;
              case 'fasting': return <FastingTracker />;
              case 'nutrition': return <CalorieTracker />;
              case 'workout': return <WorkoutTracker />;
              case 'metrics': return <BodyMetrics />;
              case 'habits': return <HabitTracker />;
              case 'sleep': return <SleepTracker />;
              case 'coach': return <AICoach />;
              case 'profile': return <Profile />;
              case 'settings': return <SettingsScreen />;
              default: return <Dashboard />;
            }
          })()}
        </motion.div>
      </AnimatePresence>
    );
  };

  const navItems = [
    { id: 'dashboard', icon: Home, label: 'หน้าหลัก' },
    { id: 'nutrition', icon: Utensils, label: 'อาหาร' },
    { id: 'workout', icon: Dumbbell, label: 'ออกกำลัง' },
    { id: 'metrics', icon: BarChart3, label: 'ร่างกาย' },
    { id: 'profile', icon: User, label: 'โปรไฟล์' },
  ];

  const secondaryNav = [
    { id: 'fasting', icon: Timer, label: 'ทำ IF' },
    { id: 'habits', icon: CheckSquare, label: 'นิสัย' },
    { id: 'sleep', icon: Moon, label: 'การนอน' },
    { id: 'coach', icon: Bot, label: 'โค้ช AI' },
    { id: 'settings', icon: Settings, label: 'ตั้งค่า' },
  ];

  return (
    <div className={`min-h-screen font-sans selection:bg-green-500/30 transition-colors duration-500 ${
      theme === 'dark' ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'
    }`}>
      {/* Main Content Area */}
      <main className="max-w-md mx-auto min-h-screen pb-24">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 backdrop-blur-xl border-t z-40 transition-colors duration-500 ${
        theme === 'dark' ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-zinc-200'
      }`}>
        <div className="max-w-md mx-auto flex justify-around items-center py-3 px-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                haptics.light();
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                activeTab === item.id 
                  ? 'text-green-500 scale-110' 
                  : theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
          
          {/* More Menu Button (Mobile Style) */}
          <div className="relative group">
            <button className={`flex flex-col items-center gap-1 transition-colors ${
              theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'
            }`}>
              <div className="grid grid-cols-2 gap-0.5">
                <div className="w-1.5 h-1.5 bg-current rounded-full" />
                <div className="w-1.5 h-1.5 bg-current rounded-full" />
                <div className="w-1.5 h-1.5 bg-current rounded-full" />
                <div className="w-1.5 h-1.5 bg-current rounded-full" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">เพิ่มเติม</span>
            </button>
            
            {/* Popover Menu */}
            <div className={`absolute bottom-full right-0 mb-4 w-48 border rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 p-2 space-y-1 ${
              theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
            }`}>
              {secondaryNav.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    haptics.light();
                    setActiveTab(item.id);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    activeTab === item.id 
                      ? 'bg-green-500 text-black' 
                      : theme === 'dark' ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
                  }`}
                >
                  <item.icon size={18} />
                  <span className="text-sm font-bold">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
