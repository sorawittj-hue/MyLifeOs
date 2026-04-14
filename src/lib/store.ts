import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db, type User, type DashboardWidget } from './db';
import { seedDatabase } from './seed';
import { auth, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { firebaseService } from './firebaseService';
import { registerForPushNotifications } from './notifications';
import { type RecoveryResult, type StrainResult, type SleepPerformanceResult, type HabitCorrelation, type AgenticIntervention } from './healthAlgorithms';

export type TabName = 'dashboard' | 'nutrition' | 'fasting' | 'metrics' | 'habits' | 'workouts' | 'sleep' | 'coach' | 'profile' | 'settings';

// ── Default Dashboard Widgets ────────────────────────────────
const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: 'steps', order: 0, visible: true, size: 'large' },
  { id: 'calories', order: 1, visible: true, size: 'large' },
  { id: 'water', order: 2, visible: true, size: 'medium' },
  { id: 'heartRate', order: 3, visible: true, size: 'small' },
  { id: 'sleep', order: 4, visible: true, size: 'small' },
  { id: 'weight', order: 5, visible: true, size: 'large' },
  { id: 'fasting', order: 6, visible: true, size: 'medium' },
  { id: 'streaks', order: 7, visible: true, size: 'large' },
  { id: 'quickActions', order: 8, visible: true, size: 'medium' },
];

// ── Daily Health Metrics (Recovery + Strain) ─────────────────
export interface DailyMetrics {
  recovery: RecoveryResult | null;
  strain: StrainResult | null;
  sleepPerformance: SleepPerformanceResult | null;
  habitCorrelations: HabitCorrelation[];
  agenticInterventions?: AgenticIntervention[];
  aiInsight: string;
  lastUpdated: string; // yyyy-MM-dd
}

interface AppState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoaded: boolean;
  isAuthReady: boolean;
  activeTab: TabName;
  theme: 'dark' | 'light';
  units: 'metric' | 'imperial';
  notifications: {
    water: boolean;
    food: boolean;
    sleep: boolean;
    fasting: boolean;
    push: boolean;
  };
  googleFitTokens: any | null;
  isGoogleFitConnected: boolean;
  demoMode: boolean;
  // Connection state (UI indicator only — no manual sync needed)
  isOnline: boolean;
  // Dashboard layout
  dashboardWidgets: DashboardWidget[];
  // FCM token
  fcmToken: string | null;
  // Daily health metrics
  dailyMetrics: DailyMetrics | null;

  // Actions
  setUser: (user: User) => void;
  setActiveTab: (tab: TabName) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setUnits: (units: 'metric' | 'imperial') => void;
  setNotifications: (notifs: Partial<AppState['notifications']>) => void;
  setGoogleFitTokens: (tokens: any | null) => void;
  setDemoMode: (enabled: boolean) => void;
  setDashboardWidgets: (widgets: DashboardWidget[]) => void;
  reorderDashboardWidget: (fromIndex: number, toIndex: number) => void;
  toggleDashboardWidget: (widgetId: string) => void;
  setDailyMetrics: (metrics: DailyMetrics) => void;
  loadUser: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      firebaseUser: null,
      isLoaded: false,
      isAuthReady: false,
      activeTab: 'dashboard',
      theme: 'dark',
      units: 'metric',
      notifications: { water: true, food: false, sleep: true, fasting: true, push: false },
      googleFitTokens: null,
      isGoogleFitConnected: false,
      demoMode: false,
      isOnline: navigator.onLine,
      dashboardWidgets: DEFAULT_DASHBOARD_WIDGETS,
      fcmToken: null,
      dailyMetrics: null,

      setUser: async (user) => {
        const firebaseUser = get().firebaseUser;
        if (firebaseUser) {
          await firebaseService.setUserProfile(firebaseUser.uid, user);
        }
        const id = await db.users.put(user);
        set({ user: { ...user, id } });
      },

      setActiveTab: (tab) => set({ activeTab: tab }),

      setTheme: (theme) => set({ theme }),

      setUnits: (units) => set({ units }),

      setNotifications: (notifs) => set((state) => ({
        notifications: { ...state.notifications, ...notifs }
      })),

      setGoogleFitTokens: (tokens) => {
        if (tokens) {
          set({ googleFitTokens: tokens, isGoogleFitConnected: true });
        } else {
          set({ googleFitTokens: null, isGoogleFitConnected: false });
        }
      },

      setDemoMode: (enabled) => set({ demoMode: enabled }),

      // ── Dashboard Widget Operations ────────────────────────
      setDashboardWidgets: (widgets) => set({ dashboardWidgets: widgets }),

      reorderDashboardWidget: (fromIndex, toIndex) => {
        const widgets = [...get().dashboardWidgets];
        const [moved] = widgets.splice(fromIndex, 1);
        widgets.splice(toIndex, 0, moved);
        // Re-assign order values
        const reordered = widgets.map((w, i) => ({ ...w, order: i }));
        set({ dashboardWidgets: reordered });
      },

      toggleDashboardWidget: (widgetId) => {
        const widgets = get().dashboardWidgets.map(w =>
          w.id === widgetId ? { ...w, visible: !w.visible } : w
        );
        set({ dashboardWidgets: widgets });
      },

      setDailyMetrics: (metrics) => set({ dailyMetrics: metrics }),

      // ── Sync Operations (deprecated — Firebase Offline Persistence handles this) ──
      // triggerSync kept as no-op for any remaining call-sites
      // triggerSync: async () => {},

      login: async () => {
        console.log('[Store] Initiating Google login...');
        try {
          await signInWithPopup(auth, googleProvider);
          console.log('[Store] Login successful');
        } catch (error: any) {
          console.error('[Store] Login failed:', error);

          // Provide user-friendly error messages
          if (error.code === 'auth/popup-closed-by-user') {
            console.log('[Store] User closed popup');
            return; // Don't show alert for this
          }

          if (error.code === 'auth/configuration-not-found') {
            alert('ไม่สามารถเข้าสู่ระบบได้: คุณยังไม่ได้เปิดใช้งาน Google Sign-in ใน Firebase Console ของโปรเจกต์นี้ครับ');
          } else if (error.code === 'auth/unauthorized-domain') {
            alert('ไม่สามารถเข้าสู่ระบบได้: โดเมนปัจจุบันยังไม่ได้รับอนุญาต กรุณาไปที่ Firebase Console > Authentication > Settings > Authorized domains แล้วเพิ่ม ' + window.location.hostname);
          } else if (error.code === 'auth/popup-blocked') {
            alert('กรุณาอนุญาตป๊อปอัปในเบราว์เซอร์ของคุณเพื่อเข้าสู่ระบบ');
          } else if (error.code === 'auth/cancelled-popup-request') {
            console.log('[Store] Login cancelled');
          } else {
            alert(`เข้าสู่ระบบไม่สำเร็จ: ${error.message || 'Unknown error'}`);
          }
        }
      },

      logout: async () => {
        try {
          await signOut(auth);
          set({ firebaseUser: null, user: null, isGoogleFitConnected: false, googleFitTokens: null });
          window.location.reload();
        } catch (error) {
          console.error('Logout failed:', error);
        }
      },

      loadUser: async () => {
        console.log('[Store] Loading user data...');

        // Monitor online status (UI indicator only)
        const updateOnlineStatus = () => {
          const online = navigator.onLine;
          console.log(`[Store] Online status changed: ${online}`);
          set({ isOnline: online });
          // Firebase Offline Persistence automatically re-syncs when back online
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        // Listen for auth changes
        onAuthStateChanged(auth, async (fbUser) => {
          console.log('[Store] Auth state changed:', fbUser ? fbUser.uid : 'null');

          if (fbUser) {
            set({ firebaseUser: fbUser, isAuthReady: true });

            // Firebase onSnapshot listeners are the source of truth for all collection data.
            // No manual Dexie-to-Firebase push needed — offline persistence handles that.

            try {
              // Quick load from local to unblock UI immediately
              console.log('[Store] Loading local user data...');
              const users = await db.users.toArray();
              if (users.length > 0) {
                console.log('[Store] Local user found:', users[0].name);
                set({ user: users[0], isLoaded: true });
              } else {
                console.log('[Store] No local user, creating default...');
                const defaultUser: User = {
                  name: fbUser.displayName || 'ผู้ใช้งาน',
                  age: 31,
                  weight: 84,
                  height: 171,
                  gender: 'male',
                  targetWeight: 67,
                  dailyCalorieTarget: 2200,
                };
                try {
                  const id = await db.users.add(defaultUser);
                  console.log('[Store] Default user created with ID:', id);
                  set({ user: { ...defaultUser, id }, isLoaded: true });
                } catch (dbErr) {
                  console.error("[Store] Local db add failed:", dbErr);
                  set({ user: defaultUser, isLoaded: true });
                }
              }

              // Fire and forget background tasks
              (async () => {
                try {
                  console.log('[Store] Running background tasks...');

                  // Load profile from Firebase with timeout
                  const profilePromise = firebaseService.getUserProfile(fbUser.uid);
                  let timeoutId: NodeJS.Timeout | number;
                  const timeoutPromise = new Promise((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error('Timeout fetching profile')), 10000);
                  });

                  const profile = await Promise.race([profilePromise, timeoutPromise]).catch(e => {
                    console.error("[Store] Failed to load user profile:", e);
                    return null;
                  }).finally(() => {
                    clearTimeout(timeoutId);
                  });

                  // Update with remote profile if available
                  if (profile) {
                    console.log('[Store] Remote profile loaded');
                    set({ user: profile as User });
                    // Also update local DB
                    const users = await db.users.toArray();
                    if (users.length > 0 && users[0].id) {
                      await db.users.put({ ...(profile as User), id: users[0].id });
                    }
                  } else {
                    console.log('[Store] No remote profile, creating from local...');
                    const { user } = get();
                    if (user) {
                      await firebaseService.setUserProfile(fbUser.uid, user).catch(e =>
                        console.error("[Store] Failed to create default remote user profile:", e)
                      );
                    }
                  }

                  // Push notifications
                  const { notifications } = get();
                  if (notifications.push) {
                    try {
                      console.log('[Store] Registering for push notifications...');
                      const token = await registerForPushNotifications();
                      if (token) {
                        console.log('[Store] Push token received');
                        set({ fcmToken: token });
                      }
                    } catch (pushErr) {
                      console.error("[Store] Register push err:", pushErr);
                    }
                  }

                  console.log('[Store] Background tasks completed');
                } catch (bgError) {
                  console.error("[Store] Background tasks failed:", bgError);
                  // Don't let background task failures affect user experience
                }
              })();

            } catch (error) {
              console.error("[Store] Critical error during user load:", error);
              set({ isLoaded: true }); // Prevent hanging infinitely
            }
          } else {
            console.log('[Store] User logged out');
            set({ firebaseUser: null, isAuthReady: true });

            // Fallback to local user if not logged in
            try {
              const users = await db.users.toArray();
              if (users.length > 0) {
                set({ user: users[0], isLoaded: true });
              } else {
                const defaultUser: User = {
                  name: 'ผู้ใช้งาน',
                  age: 31,
                  weight: 84,
                  height: 171,
                  gender: 'male',
                  targetWeight: 67,
                  dailyCalorieTarget: 2200,
                };
                const id = await db.users.add(defaultUser);
                set({ user: { ...defaultUser, id }, isLoaded: true });
              }
            } catch (error) {
              console.error("[Store] Local database error during user load:", error);
              set({ isLoaded: true }); // Prevent UI from hanging
            }
          }
        });

        try {
          await seedDatabase();
        } catch (e) {
          console.error("[Store] Failed to seed database:", e);
        }

        console.log('[Store] loadUser completed');
      },
    }),
    {
      name: 'lifeos-storage',
      partialize: (state) => ({
        theme: state.theme,
        units: state.units,
        notifications: state.notifications,
        isGoogleFitConnected: state.isGoogleFitConnected,
        demoMode: state.demoMode,
        dashboardWidgets: state.dashboardWidgets,
        fcmToken: state.fcmToken,
      }),
    }
  )
);
