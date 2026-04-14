import React, { useState, useEffect } from 'react';
import { Settings, User, Bell, Shield, Database, Moon, Sun, Monitor, ChevronRight, LogOut, Trash2, X, Save, Download, Info, Watch, Smartphone, RefreshCw } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { haptics } from '../lib/haptics';
import { db } from '../lib/db';
import { motion, AnimatePresence } from 'motion/react';
import { requestNotificationPermission, sendNotification, syncNotificationSchedule } from '../lib/notifications';
import { fetchGoogleFitData } from '../lib/googleFit';

export default function SettingsScreen() {
  const { user, setUser, theme, setTheme, units, setUnits, notifications, setNotifications, isGoogleFitConnected, setGoogleFitTokens, googleFitTokens, demoMode, setDemoMode } = useAppStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOAuthHelp, setShowOAuthHelp] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleGoogleFitConnect = async () => {
    haptics.light();
    try {
      console.log('[Settings] Initiating Google Fit OAuth flow');
      const response = await fetch('/api/auth/google/url');
      const data = await response.json();

      if (!response.ok) {
        console.error('[Settings] Google Fit auth URL failed:', data);
        if (data.error === 'MISSING_SECRETS') {
          alert(data.message);
        } else {
          alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + (data.message || 'Unknown error'));
        }
        return;
      }

      const { url } = data;
      console.log('[Settings] Opening Google Fit auth window:', url);
      const authWindow = window.open(url, 'google_fit_auth', 'width=600,height=700');

      if (!authWindow) {
        alert('กรุณาอนุญาตป๊อปอัปเพื่อเชื่อมต่อ Google Fit');
        return;
      }

      console.log('[Settings] Auth window opened successfully');
    } catch (error) {
      console.error('[Settings] Failed to get auth URL:', error);
      alert('ไม่สามารถเชื่อมต่อ Google Fit ได้: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleSync = async () => {
    if (!googleFitTokens && !demoMode) return;
    haptics.medium();
    setIsSyncing(true);
    try {
      if (demoMode) {
        // Simulate sync delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        // Mock data update logic would be in fetchGoogleFitData or here
        await fetchGoogleFitData(googleFitTokens || {} as any, setGoogleFitTokens, true);
      } else {
        await fetchGoogleFitData(googleFitTokens!, setGoogleFitTokens);
      }
      sendNotification('ซิงค์ข้อมูลสำเร็จ!', { body: 'ข้อมูลสุขภาพถูกอัปเดตแล้ว' });
    } catch (error) {
      console.error('Sync failed:', error);
      if (!demoMode) alert('การซิงค์ล้มเหลว: กรุณาตรวจสอบการเชื่อมต่อ Google Fit หรือลองใช้ Demo Mode');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('[Settings] Received message event:', event.data?.type);
      if (event.data?.type === 'GOOGLE_FIT_AUTH_SUCCESS') {
        console.log('[Settings] Google Fit auth success, storing tokens');
        setGoogleFitTokens(event.data.tokens);
        sendNotification('เชื่อมต่อ Google Fit สำเร็จ!', { body: 'เชื่อมต่อแล้ว! อย่าลืมเปิด Health Connect ในมือถือ Samsung ของคุณด้วยนะครับ' });
      } else if (event.data?.type === 'GOOGLE_FIT_AUTH_ERROR') {
        console.error('[Settings] Google Fit auth error:', event.data.error);
        alert('การเชื่อมต่อ Google Fit ล้มเหลว: ' + (event.data.error || 'Unknown error'));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const toggleNotification = async (key: keyof typeof notifications) => {
    haptics.light();
    if (!notifications[key]) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        alert('กรุณาอนุญาตการแจ้งเตือนในเบราว์เซอร์ของคุณ');
        return;
      }
      sendNotification('เปิดการแจ้งเตือนสำเร็จ!', { body: `คุณจะได้รับการแจ้งเตือนเกี่ยวกับ${key === 'water' ? 'การดื่มน้ำ' : key === 'food' ? 'การบันทึกอาหาร' : 'การนอน'}` });
    }
    setNotifications({ [key]: !notifications[key] });
    // Sync notification scheduling
    const updated = { ...notifications, [key]: !notifications[key] };
    syncNotificationSchedule(updated);
  };

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    age: user?.age || 0,
    weight: user?.weight || 0,
    height: user?.height || 0,
    targetWeight: user?.targetWeight || 0,
    dailyCalorieTarget: user?.dailyCalorieTarget || 0,
    gender: user?.gender || 'male'
  });

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        age: user.age,
        weight: user.weight,
        height: user.height,
        targetWeight: user.targetWeight,
        dailyCalorieTarget: user.dailyCalorieTarget,
        gender: user.gender
      });
    }
  }, [user]);

  const clearData = async () => {
    await db.delete();
    window.location.reload();
  };

  const handleSaveProfile = async () => {
    if (user) {
      haptics.success();
      const updatedUser = { ...user, ...profileForm };
      await setUser(updatedUser);
      setShowEditProfile(false);
    }
  };

  const exportData = async () => {
    setIsExporting(true);
    try {
      const allData: any = {};
      const tables = db.tables;

      for (const table of tables) {
        allData[table.name] = await table.toArray();
      }

      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifeos-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogout = () => {
    // In this app, logout just resets the session/reload
    if (confirm('คุณต้องการออกจากระบบหรือไม่? ข้อมูลของคุณจะยังคงอยู่ในเครื่องนี้')) {
      window.location.reload();
    }
  };

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'glass-card' : 'glass-card-light';
  const textMuted = isDark ? 'text-zinc-500' : 'text-zinc-400';
  const divideColor = isDark ? 'divide-white/[0.04]' : 'divide-black/[0.04]';

  return (
    <div className="p-5 space-y-6 pb-28">
      <header>
        <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${textMuted} mb-0.5`}>Settings</p>
        <h1 className="text-2xl font-bold tracking-tight">การตั้งค่า</h1>
      </header>

      {/* Profile Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBg} bento-card overflow-hidden`}
      >
        <div className={`p-5 flex items-center gap-4 border-b ${isDark ? 'border-white/[0.04]' : 'border-black/[0.04]'}`}>
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center text-black font-bold text-2xl">
            {user?.name?.[0] || (user?.gender === 'male' ? 'M' : 'F')}
          </div>
          <div>
            <h2 className="text-lg font-bold">{user?.name || 'ผู้ใช้งาน'}</h2>
            <p className={`text-sm ${textMuted}`}>LifeOS Member</p>
          </div>
          <button
            onClick={() => setShowEditProfile(true)}
            className={`ml-auto p-2 rounded-xl transition-colors ${isDark ? 'bg-white/[0.06] text-zinc-400 hover:text-white' : 'bg-black/[0.04] text-zinc-500 hover:text-zinc-900'}`}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className={`grid grid-cols-3 divide-x ${divideColor}`}>
          <div className="p-4 text-center">
            <p className={`text-[10px] ${textMuted} font-bold uppercase`}>น้ำหนัก</p>
            <p className="font-bold">{user?.weight} กก.</p>
          </div>
          <div className="p-4 text-center">
            <p className={`text-[10px] ${textMuted} font-bold uppercase`}>ส่วนสูง</p>
            <p className="font-bold">{user?.height} ซม.</p>
          </div>
          <div className="p-4 text-center">
            <p className={`text-[10px] ${textMuted} font-bold uppercase`}>อายุ</p>
            <p className="font-bold">{user?.age}</p>
          </div>
        </div>
      </motion.section>

      {/* Preferences */}
      <section className="space-y-3">
        <h3 className={`text-xs font-bold ${textMuted} uppercase tracking-widest px-1`}>ความชอบ</h3>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`${cardBg} bento-card divide-y ${divideColor}`}
        >
          <div className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center">
                <Moon size={20} />
              </div>
              <span className="font-medium">ธีม</span>
            </div>
            <div className={`flex p-1 rounded-xl ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.04]'}`}>
              <button
                onClick={() => {
                  haptics.light();
                  setTheme('dark');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${theme === 'dark' ? 'bg-white/[0.1] text-white' : 'text-zinc-500'}`}
              >
                มืด
              </button>
              <button
                onClick={() => {
                  haptics.light();
                  setTheme('light');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${theme === 'light' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
              >
                สว่าง
              </button>
            </div>
          </div>
          <div className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center">
                <Database size={20} />
              </div>
              <span className="font-medium">หน่วย</span>
            </div>
            <div className={`flex p-1 rounded-xl ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.04]'}`}>
              <button
                onClick={() => {
                  haptics.light();
                  setUnits('metric');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${units === 'metric' ? (isDark ? 'bg-white/[0.1] text-white' : 'bg-white text-zinc-900 shadow-sm') : 'text-zinc-500'}`}
              >
                เมตริก
              </button>
              <button
                onClick={() => {
                  haptics.light();
                  setUnits('imperial');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${units === 'imperial' ? (isDark ? 'bg-white/[0.1] text-white' : 'bg-white text-zinc-900 shadow-sm') : 'text-zinc-500'}`}
              >
                อิมพีเรียล
              </button>
            </div>
          </div>
          <div className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center">
                <Bell size={20} />
              </div>
              <span className="font-medium">การแจ้งเตือน</span>
            </div>
            <button
              onClick={() => setShowNotifications(true)}
              className={`${textMuted} hover:text-green-500 transition-colors`}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </motion.div>
      </section>

      {/* Devices & Integrations */}
      <section className="space-y-3">
        <h3 className={`text-xs font-bold ${textMuted} uppercase tracking-widest px-1`}>อุปกรณ์และการเชื่อมต่อ</h3>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`${cardBg} bento-card divide-y ${divideColor}`}
        >
          <div className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/10 text-yellow-500 rounded-xl flex items-center justify-center">
                <Monitor size={20} />
              </div>
              <div>
                <span className="font-medium block">โหมดทดลอง (Demo Mode)</span>
                <span className={`text-[10px] ${textMuted}`}>ใช้ข้อมูลจำลองแทนข้อมูลจริง</span>
              </div>
            </div>
            <button
              onClick={() => {
                haptics.light();
                setDemoMode(!demoMode);
              }}
              className={`w-12 h-6 rounded-full relative p-1 transition-colors ${demoMode ? 'bg-yellow-500' : (isDark ? 'bg-white/[0.1]' : 'bg-black/[0.1]')}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-all ${demoMode ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>
          <div className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center">
                <Smartphone size={20} />
              </div>
              <div>
                <span className="font-medium block">Samsung S23 Ultra</span>
                <span className={`text-[10px] ${textMuted}`}>เชื่อมต่อผ่าน Google Fit</span>
              </div>
            </div>
            {isGoogleFitConnected ? (
              <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-full uppercase">Connected</span>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowOAuthHelp(true)}
                  className={`p-2 rounded-lg ${isDark ? 'bg-white/[0.06] text-zinc-400' : 'bg-black/[0.04] text-zinc-500'}`}
                >
                  <Info size={16} />
                </button>
                <button
                  onClick={handleGoogleFitConnect}
                  disabled={demoMode}
                  className={`text-xs font-bold ${demoMode ? 'text-zinc-500' : 'text-green-500 hover:underline'}`}
                >
                  Connect
                </button>
              </div>
            )}
          </div>
          <div className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center">
                <Watch size={20} />
              </div>
              <div>
                <span className="font-medium block">Aolon Curve 3 Ultra</span>
                <span className={`text-[10px] ${textMuted}`}>เชื่อมต่อผ่าน Google Fit</span>
              </div>
            </div>
            {isGoogleFitConnected ? (
              <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-full uppercase">Connected</span>
            ) : (
              <button
                onClick={handleGoogleFitConnect}
                className="text-xs font-bold text-green-500 hover:underline"
              >
                Connect
              </button>
            )}
          </div>
          {isGoogleFitConnected && (
            <div className="p-4">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className={`w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all ${isSyncing ? 'bg-zinc-100 text-zinc-400' : 'bg-green-500 text-black shadow-lg shadow-green-500/20 active:scale-95'
                  }`}
              >
                <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'กำลังซิงค์ข้อมูล...' : 'ซิงค์ข้อมูลตอนนี้'}
              </button>
              <p className={`text-[10px] text-center mt-3 ${textMuted}`}>
                *สำหรับผู้ใช้ <b>Samsung S23</b> และนาฬิกา <b>Aolon</b>: ต้องเปิดการซิงค์ในแอป <b>Health Connect</b> เพื่อดึงข้อมูลจาก Samsung Health มายัง Google Fit ก่อนครับ
              </p>
            </div>
          )}
        </motion.div>
      </section>

      {/* Data & Privacy */}
      <section className="space-y-3">
        <h3 className={`text-xs font-bold ${textMuted} uppercase tracking-widest px-1`}>ข้อมูลและความเป็นส่วนตัว</h3>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`${cardBg} bento-card divide-y ${divideColor}`}
        >
          <button
            onClick={() => setShowPrivacy(true)}
            className={`w-full p-4 flex justify-between items-center transition-colors ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.02]'}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center">
                <Shield size={20} />
              </div>
              <span className="font-medium text-left">นโยบายความเป็นส่วนตัว</span>
            </div>
            <ChevronRight size={20} className={isDark ? 'text-zinc-700' : 'text-zinc-300'} />
          </button>
          <button
            onClick={exportData}
            disabled={isExporting}
            className={`w-full p-4 flex justify-between items-center transition-colors disabled:opacity-50 ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.02]'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/[0.06] text-zinc-400' : 'bg-black/[0.04] text-zinc-500'}`}>
                <Download size={20} />
              </div>
              <span className="font-medium text-left">{isExporting ? 'กำลังส่งออก...' : 'ส่งออกข้อมูล (JSON)'}</span>
            </div>
            <ChevronRight size={20} className={isDark ? 'text-zinc-700' : 'text-zinc-300'} />
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            className={`w-full p-4 flex justify-between items-center transition-colors group ${isDark ? 'hover:bg-red-500/[0.04]' : 'hover:bg-red-50'}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <span className="font-medium text-red-500">ลบข้อมูลทั้งหมด</span>
            </div>
          </button>
        </motion.div>
      </section>

      <div className="text-center space-y-1">
        <p className={`text-xs ${isDark ? 'text-zinc-600' : 'text-zinc-400'} font-bold uppercase tracking-widest`}>LifeOS v1.0.0</p>
        <p className={`text-[10px] ${isDark ? 'text-zinc-700' : 'text-zinc-500'}`}>สร้างด้วย ❤️ เพื่อสุขภาพของคุณ</p>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleLogout}
        className={`w-full border font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors ${isDark
          ? 'glass-card text-zinc-400 hover:bg-white/[0.06]'
          : 'glass-card-light text-zinc-500 hover:bg-black/[0.04]'
          }`}
      >
        <LogOut size={18} />
        ออกจากระบบ
      </motion.button>

      {/* OAuth Help Modal */}
      <AnimatePresence>
        {showOAuthHelp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={() => setShowOAuthHelp(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`w-full max-w-md rounded-[2rem] p-6 space-y-5 ${isDark ? 'bg-[#141414] border border-white/[0.06]' : 'bg-white border border-black/[0.06] shadow-2xl'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">วิธีตั้งค่า Google Fit</h2>
                <button onClick={() => setShowOAuthHelp(false)} className={`${textMuted} hover:text-green-500`}>
                  <X size={24} />
                </button>
              </div>

              <div className={`space-y-4 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                <p className="text-red-500 font-bold">⚠️ สำคัญ: เพื่อความปลอดภัย ห้ามแชร์รหัสผ่าน Gmail ให้ใครเด็ดขาด ผมไม่สามารถเข้าถึงบัญชีของคุณเพื่อตั้งค่าให้ได้ คุณต้องทำตามขั้นตอนสั้นๆ นี้ครับ:</p>

                <div className="space-y-2">
                  <p className="font-bold text-white">1. ไปที่ Google Cloud Console</p>
                  <p className="text-xs">ค้นหาใน Google ว่า "Google Cloud Credentials" แล้วเข้าลิงก์แรก</p>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-white">2. สร้าง OAuth Client ID</p>
                  <p className="text-xs">เลือกประเภท "Web application" และใส่ชื่ออะไรก็ได้</p>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-white">3. ใส่ Redirect URI</p>
                  <div className={`p-2 rounded-lg font-mono text-[10px] break-all ${isDark ? 'bg-white/[0.06]' : 'bg-black/[0.04]'}`}>
                    {window.location.origin}/auth/callback
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-white">4. นำรหัสมาใส่ใน AI Studio</p>
                  <p className="text-xs">ก๊อปปี้ Client ID และ Secret ไปใส่ในเมนู Settings &gt; Secrets ของหน้าจอ AI Studio (ฝั่งซ้ายมือของคุณ)</p>
                </div>

                <div className={`p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-yellow-500 text-xs`}>
                  💡 หากทำไม่เป็นจริงๆ สามารถเปิด <b>"โหมดทดลอง (Demo Mode)"</b> เพื่อดูการทำงานของแอปด้วยข้อมูลจำลองได้ครับ
                </div>
              </div>

              <button
                onClick={() => setShowOAuthHelp(false)}
                className={`w-full font-bold py-4 rounded-2xl transition-colors ${isDark ? 'bg-white/[0.06] text-white hover:bg-white/[0.1]' : 'bg-black/[0.04] text-zinc-900 hover:bg-black/[0.06]'}`}
              >
                เข้าใจแล้ว
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showEditProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={() => setShowEditProfile(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`w-full max-w-md rounded-[2rem] p-6 space-y-5 ${isDark ? 'bg-[#141414] border border-white/[0.06]' : 'bg-white border border-black/[0.06] shadow-2xl'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">แก้ไขข้อมูลส่วนตัว</h2>
                <button onClick={() => setShowEditProfile(false)} className={`${textMuted} hover:text-green-500`}>
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className={`text-xs font-bold ${textMuted} uppercase`}>ชื่อ</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    className={`w-full rounded-xl p-3 outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'input-premium text-white' : 'input-premium-light text-zinc-900'}`}
                    placeholder="ใส่ชื่อของคุณ"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={`text-xs font-bold ${textMuted} uppercase`}>อายุ</label>
                    <input
                      type="number"
                      value={profileForm.age}
                      onChange={e => setProfileForm({ ...profileForm, age: parseInt(e.target.value) })}
                      className={`w-full border-none rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none ${theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-xs font-bold ${textMuted} uppercase`}>เพศ</label>
                    <select
                      value={profileForm.gender}
                      onChange={e => setProfileForm({ ...profileForm, gender: e.target.value })}
                      className={`w-full border-none rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none ${theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'}`}
                    >
                      <option value="male">ชาย</option>
                      <option value="female">หญิง</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={`text-xs font-bold ${textMuted} uppercase`}>น้ำหนัก (กก.)</label>
                    <input
                      type="number"
                      value={profileForm.weight}
                      onChange={e => setProfileForm({ ...profileForm, weight: parseFloat(e.target.value) })}
                      className={`w-full border-none rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none ${theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-xs font-bold ${textMuted} uppercase`}>ส่วนสูง (ซม.)</label>
                    <input
                      type="number"
                      value={profileForm.height}
                      onChange={e => setProfileForm({ ...profileForm, height: parseFloat(e.target.value) })}
                      className={`w-full border-none rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none ${theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={`text-xs font-bold ${textMuted} uppercase`}>เป้าหมาย (กก.)</label>
                    <input
                      type="number"
                      value={profileForm.targetWeight}
                      onChange={e => setProfileForm({ ...profileForm, targetWeight: parseFloat(e.target.value) })}
                      className={`w-full border-none rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none ${theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={`text-xs font-bold ${textMuted} uppercase`}>แคลอรี่ต่อวัน</label>
                    <input
                      type="number"
                      value={profileForm.dailyCalorieTarget}
                      onChange={e => setProfileForm({ ...profileForm, dailyCalorieTarget: parseInt(e.target.value) })}
                      className={`w-full border-none rounded-xl p-3 focus:ring-2 focus:ring-green-500 outline-none ${theme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'}`}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveProfile}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
              >
                <Save size={20} />
                บันทึกการเปลี่ยนแปลง
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Policy Modal */}
      <AnimatePresence>
        {showPrivacy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={() => setShowPrivacy(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`w-full max-w-md rounded-[2rem] p-6 space-y-5 ${isDark ? 'bg-[#141414] border border-white/[0.06]' : 'bg-white border border-black/[0.06] shadow-2xl'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">นโยบายความเป็นส่วนตัว</h2>
                <button onClick={() => setShowPrivacy(false)} className={`${textMuted} hover:text-green-500`}>
                  <X size={24} />
                </button>
              </div>
              <div className={`max-h-[60vh] overflow-y-auto pr-2 space-y-4 text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                <p>LifeOS ให้ความสำคัญกับความเป็นส่วนตัวของคุณ ข้อมูลทั้งหมดของคุณจะถูกเก็บไว้ในอุปกรณ์ของคุณเท่านั้น (Local Storage) และไม่มีการส่งข้อมูลไปยังเซิร์ฟเวอร์ภายนอก</p>
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>1. การเก็บรวบรวมข้อมูล</h3>
                <p>เราเก็บข้อมูลสุขภาพพื้นฐาน เช่น อายุ น้ำหนัก ส่วนสูง และบันทึกกิจกรรมประจำวันของคุณเพื่อใช้ในการคำนวณและแสดงผลสถิติ</p>
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>2. การใช้งานข้อมูล</h3>
                <p>ข้อมูลจะถูกใช้เพื่อช่วยให้คุณติดตามสุขภาพและบรรลุเป้าหมายที่ตั้งไว้เท่านั้น</p>
                <h3 className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>3. การควบคุมข้อมูล</h3>
                <p>คุณสามารถลบข้อมูลทั้งหมดได้ตลอดเวลาผ่านเมนู "ลบข้อมูลทั้งหมด" ในหน้าการตั้งค่านี้</p>
              </div>
              <button
                onClick={() => setShowPrivacy(false)}
                className={`w-full font-bold py-4 rounded-2xl transition-colors ${isDark ? 'bg-white/[0.06] text-white hover:bg-white/[0.1]' : 'bg-black/[0.04] text-zinc-900 hover:bg-black/[0.06]'}`}
              >
                รับทราบ
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications Modal */}
      <AnimatePresence>
        {showNotifications && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={() => setShowNotifications(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`w-full max-w-md rounded-[2rem] p-6 space-y-5 ${isDark ? 'bg-[#141414] border border-white/[0.06]' : 'bg-white border border-black/[0.06] shadow-2xl'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">การแจ้งเตือน</h2>
                <button onClick={() => setShowNotifications(false)} className={`${textMuted} hover:text-green-500`}>
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4">
                {[
                  { id: 'water', title: 'เตือนดื่มน้ำ', desc: 'แจ้งเตือนทุก 2 ชั่วโมง' },
                  { id: 'food', title: 'เตือนบันทึกอาหาร', desc: 'แจ้งเตือนหลังมื้ออาหาร' },
                  { id: 'sleep', title: 'เตือนการนอน', desc: 'แจ้งเตือนก่อนเวลานอน 30 นาที' },
                ].map((notif) => {
                  const isActive = notifications[notif.id as keyof typeof notifications];
                  return (
                    <div key={notif.id} className={`p-4 rounded-2xl flex items-center justify-between ${isDark ? 'bg-white/[0.03] border border-white/[0.04]' : 'bg-black/[0.02] border border-black/[0.04]'}`}>
                      <div>
                        <p className="font-bold">{notif.title}</p>
                        <p className={`text-xs ${textMuted}`}>{notif.desc}</p>
                      </div>
                      <button
                        onClick={() => toggleNotification(notif.id as keyof typeof notifications)}
                        className={`w-12 h-6 rounded-full relative p-1 transition-colors ${isActive ? 'bg-green-500' : (isDark ? 'bg-white/[0.1]' : 'bg-black/[0.1]')}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-all ${isActive ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => setShowNotifications(false)}
                className={`w-full font-bold py-4 rounded-2xl transition-colors ${isDark ? 'bg-white/[0.06] text-white hover:bg-white/[0.1]' : 'bg-black/[0.04] text-zinc-900 hover:bg-black/[0.06]'}`}
              >
                ปิด
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear Data Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={() => setShowClearConfirm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`w-full max-w-sm rounded-[2rem] p-6 space-y-5 text-center ${isDark ? 'bg-[#141414] border border-white/[0.06]' : 'bg-white border border-black/[0.06] shadow-2xl'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={40} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">ยืนยันการลบข้อมูล?</h2>
                <p className={textMuted}>ข้อมูลทั้งหมดของคุณจะถูกลบถาวรและไม่สามารถกู้คืนได้</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className={`font-bold py-4 rounded-2xl transition-colors ${isDark ? 'bg-white/[0.06] text-white hover:bg-white/[0.1]' : 'bg-black/[0.04] text-zinc-900 hover:bg-black/[0.06]'}`}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={clearData}
                  className="bg-red-500 text-white font-bold py-4 rounded-2xl hover:bg-red-600 transition-colors"
                >
                  ลบเลย
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
