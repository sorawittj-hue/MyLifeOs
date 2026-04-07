import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { type TabName } from './lib/store';
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
  const [showMore, setShowMore] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadUser();
  }, []);

  // Sync activeTab with URL
  useEffect(() => {
    const path = location.pathname.slice(1) || 'dashboard';
    if (path !== activeTab) {
      setActiveTab(path as TabName);
    }
  }, [location.pathname]);

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

  const navItems = [
    { id: 'dashboard', icon: Home, label: 'หน้าหลัก', path: '/' },
    { id: 'nutrition', icon: Utensils, label: 'อาหาร', path: '/nutrition' },
    { id: 'workout', icon: Dumbbell, label: 'ออกกำลัง', path: '/workout' },
    { id: 'metrics', icon: BarChart3, label: 'ร่างกาย', path: '/metrics' },
    { id: 'profile', icon: User, label: 'โปรไฟล์', path: '/profile' },
  ];

  const secondaryNav = [
    { id: 'fasting', icon: Timer, label: 'ทำ IF', path: '/fasting' },
    { id: 'habits', icon: CheckSquare, label: 'นิสัย', path: '/habits' },
    { id: 'sleep', icon: Moon, label: 'การนอน', path: '/sleep' },
    { id: 'coach', icon: Bot, label: 'โค้ช AI', path: '/coach' },
    { id: 'settings', icon: Settings, label: 'ตั้งค่า', path: '/settings' },
  ];

  return (
    <div className={`min-h-screen font-sans selection:bg-green-500/30 transition-colors duration-500 ${
      theme === 'dark' ? 'bg-black text-white' : 'bg-zinc-50 text-zinc-900'
    }`}>
      {/* Main Content Area */}
      <main className="max-w-md mx-auto min-h-screen pb-24">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/nutrition" element={<CalorieTracker />} />
            <Route path="/workout" element={<WorkoutTracker />} />
            <Route path="/metrics" element={<BodyMetrics />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/fasting" element={<FastingTracker />} />
            <Route path="/habits" element={<HabitTracker />} />
            <Route path="/sleep" element={<SleepTracker />} />
            <Route path="/coach" element={<AICoach />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Routes>
        </AnimatePresence>
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
                navigate(item.path);
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
          <div className="relative">
            <button 
              onClick={() => {
                haptics.light();
                setShowMore(!showMore);
              }}
              className={`flex flex-col items-center gap-1 transition-colors ${
                showMore ? 'text-green-500' : (theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600')
              }`}
            >
              <div className="grid grid-cols-2 gap-0.5">
                <div className={`w-1.5 h-1.5 ${showMore ? 'bg-green-500' : 'bg-current'} rounded-full`} />
                <div className={`w-1.5 h-1.5 ${showMore ? 'bg-green-500' : 'bg-current'} rounded-full`} />
                <div className={`w-1.5 h-1.5 ${showMore ? 'bg-green-500' : 'bg-current'} rounded-full`} />
                <div className={`w-1.5 h-1.5 ${showMore ? 'bg-green-500' : 'bg-current'} rounded-full`} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">เพิ่มเติม</span>
            </button>
            
            {/* Popover Menu */}
            <AnimatePresence>
              {showMore && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowMore(false)} 
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute bottom-full right-0 mb-4 w-48 border rounded-2xl shadow-2xl transition-all duration-300 p-2 space-y-1 z-50 ${
                      theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                    }`}
                  >
                    {secondaryNav.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          haptics.light();
                          navigate(item.path);
                          setShowMore(false);
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
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>
    </div>
  );
}
