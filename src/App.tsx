import React, { useEffect, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { type TabName } from './lib/store';
import { Home, Utensils, Dumbbell, BarChart3, User, Timer, CheckSquare, Moon, Bot, Settings } from 'lucide-react';
import { useAppStore } from './lib/store';
import { haptics } from './lib/haptics';
import ErrorBoundary from './components/ErrorBoundary';
import { motion, AnimatePresence } from 'motion/react';

// ── React.lazy: Code-split all route components ──────────────
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const FastingTracker = React.lazy(() => import('./components/FastingTracker'));
const CalorieTracker = React.lazy(() => import('./components/CalorieTracker'));
const WorkoutTracker = React.lazy(() => import('./components/WorkoutTracker'));
const BodyMetrics = React.lazy(() => import('./components/BodyMetrics'));
const HabitTracker = React.lazy(() => import('./components/HabitTracker'));
const SleepTracker = React.lazy(() => import('./components/SleepTracker'));
const SettingsScreen = React.lazy(() => import('./components/Settings'));
const Profile = React.lazy(() => import('./components/Profile'));

// ── Route Loading Fallback ───────────────────────────────────
function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full animate-breathe" />
          <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center relative shadow-lg shadow-green-500/20">
            <span className="text-xl">🌿</span>
          </div>
        </div>
        <div className="w-20 h-0.5 bg-zinc-800 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full animate-[shimmer_1.5s_ease-in-out_infinite]" 
            style={{ width: '60%' }}
          />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { activeTab, setActiveTab, isLoaded, loadUser, theme } = useAppStore();
  const [showMore, setShowMore] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // ── Apply dark mode class to <html> based on theme ─────────
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

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
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#0a0a0a]">
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
            <p className="text-xs mt-1 text-zinc-400 dark:text-zinc-600">Health Suite</p>
          </motion.div>
          {/* Loading bar */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="w-32 h-0.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden"
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
    { id: 'settings', icon: Settings, label: 'ตั้งค่า', path: '/settings' },
  ];

  return (
    <div className="min-h-screen font-sans selection:bg-green-500/30 transition-colors duration-500 bg-[#f5f5f7] text-zinc-900 dark:bg-[#0a0a0a] dark:text-white">
      {/* Ambient background mesh (dark mode only) */}
      <div className="fixed inset-0 pointer-events-none z-0 mesh-gradient opacity-0 dark:opacity-60" />

      {/* Main Content Area */}
      <main className="max-w-md mx-auto min-h-screen pb-28 relative z-10">
        <AnimatePresence mode="wait">
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="/nutrition" element={<ErrorBoundary><CalorieTracker /></ErrorBoundary>} />
              <Route path="/workout" element={<ErrorBoundary><WorkoutTracker /></ErrorBoundary>} />
              <Route path="/metrics" element={<ErrorBoundary><BodyMetrics /></ErrorBoundary>} />
              <Route path="/profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
              <Route path="/fasting" element={<ErrorBoundary><FastingTracker /></ErrorBoundary>} />
              <Route path="/habits" element={<ErrorBoundary><HabitTracker /></ErrorBoundary>} />
              <Route path="/sleep" element={<ErrorBoundary><SleepTracker /></ErrorBoundary>} />
              <Route path="/settings" element={<ErrorBoundary><SettingsScreen /></ErrorBoundary>} />
            </Routes>
          </Suspense>
        </AnimatePresence>
      </main>

      {/* Premium Floating Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)] pointer-events-none flex justify-center px-4 mb-4">
        <nav className="pointer-events-auto w-full max-w-sm rounded-[2rem] transition-all duration-500 bg-white/80 border border-black/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.08)] dark:bg-[#0a0a0a]/80 dark:border-white/[0.12] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)] relative"
          style={{ backdropFilter: 'blur(24px) saturate(200%)' }}
        >
          {/* subtle inner border for glass effect */}
          <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/20 dark:ring-white/5 pointer-events-none" />
          
          <div className="flex justify-around items-center py-2 px-2 relative z-10">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    haptics.light();
                    navigate(item.path);
                  }}
                  className="relative flex flex-col items-center gap-1 py-1.5 px-3 transition-all duration-300"
                >
                  {/* Active indicator pill */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -top-1.5 w-10 h-1.5 rounded-full bg-green-500 dark:bg-green-400 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <motion.div
                    animate={{ 
                      scale: isActive ? 1.15 : 1,
                      y: isActive ? -3 : 0,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <item.icon 
                      size={22} 
                      strokeWidth={isActive ? 2.5 : 2}
                      className={`transition-colors duration-300 ${
                        isActive 
                          ? 'text-green-600 dark:text-green-400 drop-shadow-md'
                          : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
                      }`}
                    />
                  </motion.div>
                  <span className={`text-[10px] font-bold tracking-wide transition-colors duration-300 ${
                    isActive 
                      ? 'text-green-600 dark:text-green-400 opacity-100'
                      : 'text-zinc-400 dark:text-zinc-500 opacity-0 absolute translate-y-4' // Hide text when inactive for cleaner look
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
                className="relative flex flex-col items-center gap-1 py-1.5 px-3"
              >
                <motion.div
                  animate={{ rotate: showMore ? 45 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="mt-1"
                >
                  <div className="grid grid-cols-2 gap-[3px]">
                    <div className={`w-[7px] h-[7px] rounded-full transition-colors duration-300 ${showMore ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-zinc-400 dark:bg-zinc-500'}`} />
                    <div className={`w-[7px] h-[7px] rounded-full transition-colors duration-300 ${showMore ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-zinc-400 dark:bg-zinc-500'}`} />
                    <div className={`w-[7px] h-[7px] rounded-full transition-colors duration-300 ${showMore ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-zinc-400 dark:bg-zinc-500'}`} />
                    <div className={`w-[7px] h-[7px] rounded-full transition-colors duration-300 ${showMore ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-zinc-400 dark:bg-zinc-500'}`} />
                  </div>
                </motion.div>
              </button>
              
              {/* Popover Menu */}
              <AnimatePresence>
                {showMore && (
                  <>
                    {/* Invisible backdrop just for clicking away */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
                    
                    <motion.div 
                      initial={{ opacity: 0, y: 20, scale: 0.9, filter: 'blur(10px)' }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: 20, scale: 0.9, filter: 'blur(10px)' }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className="absolute bottom-[calc(100%+1.5rem)] right-0 w-48 rounded-[1.5rem] p-2 z-50 bg-white/90 border border-black/[0.08] shadow-[0_20px_40px_rgba(0,0,0,0.15)] dark:bg-[#0a0a0a]/90 dark:border-white/[0.12] dark:shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
                      style={{ backdropFilter: 'blur(24px) saturate(200%)' }}
                    >
                      {secondaryNav.map((item, idx) => (
                        <motion.button
                          key={item.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 + 0.1 }}
                          onClick={() => {
                            haptics.light();
                            navigate(item.path);
                            setShowMore(false);
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                            activeTab === item.id 
                              ? 'bg-green-500 text-black shadow-lg shadow-green-500/20' 
                              : 'text-zinc-600 hover:bg-black/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.08]'
                          }`}
                        >
                          <item.icon size={18} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                          <span className="text-sm font-bold tracking-wide">{item.label}</span>
                        </motion.button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
