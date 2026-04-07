import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db, type User } from './db';
import { seedDatabase } from './seed';
import { auth, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { firebaseService } from './firebaseService';

interface AppState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoaded: boolean;
  isAuthReady: boolean;
  activeTab: string;
  theme: 'dark' | 'light';
  units: 'metric' | 'imperial';
  notifications: {
    water: boolean;
    food: boolean;
    sleep: boolean;
  };
  googleFitTokens: any | null;
  isGoogleFitConnected: boolean;
  demoMode: boolean;
  setUser: (user: User) => void;
  setActiveTab: (tab: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setUnits: (units: 'metric' | 'imperial') => void;
  setNotifications: (notifs: Partial<AppState['notifications']>) => void;
  setGoogleFitTokens: (tokens: any | null) => void;
  setDemoMode: (enabled: boolean) => void;
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
      notifications: { water: true, food: false, sleep: true },
      googleFitTokens: null,
      isGoogleFitConnected: false,
      demoMode: false,

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
        // Listen for auth changes
        onAuthStateChanged(auth, async (fbUser) => {
          if (fbUser) {
            set({ firebaseUser: fbUser, isAuthReady: true });
            
            // Sync local data to Firebase if logging in for the first time
            const syncData = async () => {
              const collections = [
                'foodLogs', 'waterLogs', 'stepLogs', 'sleepLogs', 
                'vitals', 'bodyMetrics', 'habits', 'habitCompletions', 
                'fastingSessions', 'workouts', 'chatMessages'
              ];

              for (const col of collections) {
                try {
                  const localData = await (db as any)[col].toArray();
                  if (localData.length > 0) {
                    for (const item of localData) {
                      // For simplicity, we just add them. Firebase rules or logic could handle duplicates.
                      await firebaseService.addToCollection(col, item);
                    }
                    // Clear local data ONLY after all items in this collection are synced successfully
                    await (db as any)[col].clear();
                  }
                } catch (error) {
                  console.error(`Failed to sync collection ${col}:`, error);
                  // If one collection fails, we continue with others but don't clear the failed one
                }
              }
            };

            await syncData();

            // Load profile from Firebase
            const profile = await firebaseService.getUserProfile(fbUser.uid);
            if (profile) {
              set({ user: profile as User, isLoaded: true });
            } else {
              // Create default profile if none exists
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
        googleFitTokens: state.googleFitTokens,
        isGoogleFitConnected: state.isGoogleFitConnected,
        demoMode: state.demoMode,
      }),
    }
  )
);
