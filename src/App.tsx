import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { type TabName } from './lib/store';
import { Home, Utensils, Dumbbell, BarChart3, User, Timer, CheckSquare, Moon, Bot, Settings } from 'lucide-react';
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
import ErrorBoundary from './components/ErrorBoundary';
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
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-zinc-50'}`}>
        <div className="flex flex-col items-center gap-6">
          {/* Animated logo */}
          <motion.div 
            className="relative"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full animate-breathe" />
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 rounded-[1.5rem] flex items-center justify-center relative shadow-xl shadow-green-500/20">
              <span className="text-3xl">🌿</span>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-center"
          >
            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-500">
              LifeOS
            </h1>
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>Health Suite</p>
          </motion.div>
          {/* Loading bar */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="w-32 h-0.5 bg-zinc-800 rounded-full overflow-hidden"
          >
            <motion.div 
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2, ease: 'easeInOut' }}
            />
          </motion.div>
        </div>
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

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen font-sans selection:bg-green-500/30 transition-colors duration-500 ${
      isDark ? 'bg-[#0a0a0a] text-white' : 'bg-[#f5f5f7] text-zinc-900'
    }`}>
      {/* Ambient background mesh */}
      {isDark && (
        <div className="fixed inset-0 pointer-events-none z-0 mesh-gradient opacity-60" />
      )}

      {/* Main Content Area */}
      <main className="max-w-md mx-auto min-h-screen pb-28 relative z-10">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="/nutrition" element={<ErrorBoundary><CalorieTracker /></ErrorBoundary>} />
            <Route path="/workout" element={<ErrorBoundary><WorkoutTracker /></ErrorBoundary>} />
            <Route path="/metrics" element={<ErrorBoundary><BodyMetrics /></ErrorBoundary>} />
            <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
            <Route path="/fasting" element={<ErrorBoundary><FastingTracker /></ErrorBoundary>} />
            <Route path="/habits" element={<ErrorBoundary><HabitTracker /></ErrorBoundary>} />
            <Route path="/sleep" element={<ErrorBoundary><SleepTracker /></ErrorBoundary>} />
            <Route path="/coach" element={<ErrorBoundary><AICoach /></ErrorBoundary>} />
            <Route path="/settings" element={<ErrorBoundary><SettingsScreen /></ErrorBoundary>} />
          </Routes>
        </AnimatePresence>
      </main>

      {/* Premium Bottom Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-500 ${
        isDark 
          ? 'bg-[#0a0a0a]/80 border-t border-white/[0.04]' 
          : 'bg-white/80 border-t border-black/[0.04]'
      }`}
        style={{ backdropFilter: 'blur(24px) saturate(180%)' }}
      >
        {/* Top glow line */}
        <div className={`absolute top-0 left-0 right-0 h-px ${isDark ? 'bg-gradient-to-r from-transparent via-white/[0.06] to-transparent' : 'bg-gradient-to-r from-transparent via-black/[0.04] to-transparent'}`} />
        
        <div className="max-w-md mx-auto flex justify-around items-center py-2 px-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  haptics.light();
                  navigate(item.path);
                }}
                className="relative flex flex-col items-center gap-0.5 py-2 px-3 transition-all duration-300"
              >
                {/* Active indicator pill */}
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className={`absolute -top-0.5 w-8 h-1 rounded-full ${isDark ? 'bg-green-400' : 'bg-green-500'}`}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <motion.div
                  animate={{ 
                    scale: isActive ? 1.1 : 1,
                    y: isActive ? -2 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <item.icon 
                    size={21} 
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className={`transition-colors duration-300 ${
                      isActive 
                        ? (isDark ? 'text-green-400' : 'text-green-600')
                        : isDark ? 'text-zinc-600' : 'text-zinc-400'
                    }`}
                  />
                </motion.div>
                <span className={`text-[9px] font-semibold tracking-wide transition-colors duration-300 ${
                  isActive 
                    ? (isDark ? 'text-green-400' : 'text-green-600')
                    : isDark ? 'text-zinc-600' : 'text-zinc-400'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
          
          {/* More Menu Button */}
          <div className="relative">
            <button 
              onClick={() => {
                haptics.light();
                setShowMore(!showMore);
              }}
              className="relative flex flex-col items-center gap-0.5 py-2 px-3"
            >
              <motion.div
                animate={{ rotate: showMore ? 45 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <div className="grid grid-cols-2 gap-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${showMore ? 'bg-green-400' : (isDark ? 'bg-zinc-600' : 'bg-zinc-400')}`} />
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${showMore ? 'bg-green-400' : (isDark ? 'bg-zinc-600' : 'bg-zinc-400')}`} />
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${showMore ? 'bg-green-400' : (isDark ? 'bg-zinc-600' : 'bg-zinc-400')}`} />
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${showMore ? 'bg-green-400' : (isDark ? 'bg-zinc-600' : 'bg-zinc-400')}`} />
                </div>
              </motion.div>
              <span className={`text-[9px] font-semibold tracking-wide transition-colors duration-300 ${
                showMore ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-zinc-600' : 'text-zinc-400')
              }`}>
                เพิ่มเติม
              </span>
            </button>
            
            {/* Popover Menu */}
            <AnimatePresence>
              {showMore && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40 modal-backdrop" 
                    onClick={() => setShowMore(false)} 
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 16, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    className={`absolute bottom-full right-0 mb-4 w-52 rounded-2xl p-1.5 z-50 ${
                      isDark ? 'glass-card' : 'glass-card-light shadow-2xl'
                    }`}
                  >
                    {secondaryNav.map((item, idx) => (
                      <motion.button
                        key={item.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        onClick={() => {
                          haptics.light();
                          navigate(item.path);
                          setShowMore(false);
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                          activeTab === item.id 
                            ? 'bg-green-500 text-black' 
                            : isDark 
                              ? 'text-zinc-300 hover:bg-white/[0.06]' 
                              : 'text-zinc-600 hover:bg-black/[0.04]'
                        }`}
                      >
                        <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                        <span className="text-sm font-semibold">{item.label}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Safe area spacer for iOS */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}
