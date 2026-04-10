import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db, type User, type DashboardWidget } from './db';
import { seedDatabase } from './seed';
import { auth, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { firebaseService } from './firebaseService';
import { syncAllCollections, getPendingSyncCount, getIsOnline } from './syncEngine';
import { registerForPushNotifications } from './notifications';

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
  // Sync state
  syncStatus: 'idle' | 'syncing' | 'error';
  pendingSyncCount: number;
  isOnline: boolean;
  // Dashboard layout
  dashboardWidgets: DashboardWidget[];
  // FCM token
  fcmToken: string | null;
  
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
  triggerSync: () => Promise<void>;
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
      syncStatus: 'idle',
      pendingSyncCount: 0,
      isOnline: navigator.onLine,
      dashboardWidgets: DEFAULT_DASHBOARD_WIDGETS,
      fcmToken: null,

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

      // ── Sync Operations ────────────────────────────────────
      triggerSync: async () => {
        const { firebaseUser } = get();
        if (!firebaseUser) return;

        set({ syncStatus: 'syncing' });
        try {
          await syncAllCollections(firebaseUser.uid);
          const pending = await getPendingSyncCount();
          set({ syncStatus: 'idle', pendingSyncCount: pending });
        } catch (error) {
          console.error('Sync failed:', error);
          set({ syncStatus: 'error' });
        }
      },

      login: async () => {
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (error) {
          console.error('Login failed:', error);
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
        // Monitor online status
        const updateOnlineStatus = () => set({ isOnline: navigator.onLine });
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        // Listen for auth changes
        onAuthStateChanged(auth, async (fbUser) => {
          if (fbUser) {
            set({ firebaseUser: fbUser, isAuthReady: true });
            
            // Sync local data to Firebase
            const syncData = async () => {
              const collections = [
                'foodLogs', 'waterLogs', 'stepLogs', 'sleepLogs', 
                'vitals', 'bodyMetrics', 'habits', 'habitCompletions', 
                'fastingSessions', 'workouts', 'chatMessages'
              ] as const;

              for (const col of collections) {
                try {
                  const table = db[col];
                  const localData = await table.toArray();
                  if (localData.length > 0) {
                    const remoteData = await firebaseService.getCollection<any>(col, fbUser.uid);
                    const remoteTimestamps = new Set(remoteData.map(d => d.timestamp || d.date || d.startTime));

                    const itemsToSync = localData.filter(item => {
                      const identifier = (item as any).timestamp || (item as any).date || (item as any).startTime;
                      return !remoteTimestamps.has(identifier);
                    });

                    if (itemsToSync.length > 0) {
                      for (let i = 0; i < itemsToSync.length; i += 500) {
                        const chunk = itemsToSync.slice(i, i + 500);
                        await firebaseService.batchAdd(col, chunk, fbUser.uid);
                      }
                    }
                    await table.clear();
                  }
                } catch (error) {
                  console.error(`Failed to sync collection ${col}:`, error);
                }
              }
            };

            await syncData();

            // Register for push notifications
            const { notifications } = get();
            if (notifications.push) {
              const token = await registerForPushNotifications();
              if (token) set({ fcmToken: token });
            }

            // Load profile from Firebase
            const profile = await firebaseService.getUserProfile(fbUser.uid);
            if (profile) {
              set({ user: profile as User, isLoaded: true });
            } else {
              const defaultUser: User = {
                name: fbUser.displayName || 'ผู้ใช้งาน',
                age: 31,
                weight: 84,
                height: 171,
                gender: 'male',
                targetWeight: 67,
                dailyCalorieTarget: 2200,
              };
              await firebaseService.setUserProfile(fbUser.uid, defaultUser);
              set({ user: defaultUser, isLoaded: true });
            }
          } else {
            set({ firebaseUser: null, isAuthReady: true });
            // Fallback to local user if not logged in
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
          }
        });
        await seedDatabase();
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
