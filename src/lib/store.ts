import { create } from 'zustand';
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

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  firebaseUser: null,
  isLoaded: false,
  isAuthReady: false,
  activeTab: 'dashboard',
  theme: (localStorage.getItem('lifeos-theme') as 'dark' | 'light') || 'dark',
  units: (localStorage.getItem('lifeos-units') as 'metric' | 'imperial') || 'metric',
  notifications: JSON.parse(localStorage.getItem('lifeos-notifications') || '{"water":true,"food":false,"sleep":true}'),
  googleFitTokens: JSON.parse(localStorage.getItem('lifeos-google-fit-tokens') || 'null'),
  isGoogleFitConnected: !!localStorage.getItem('lifeos-google-fit-tokens'),
  demoMode: localStorage.getItem('lifeos-demo-mode') === 'true',
  setUser: async (user) => {
    const firebaseUser = get().firebaseUser;
    if (firebaseUser) {
      await firebaseService.setUserProfile(firebaseUser.uid, user);
    }
    const id = await db.users.put(user);
    set({ user: { ...user, id } });
  },
  setActiveTab: (tab) => set({ activeTab: tab }),
  setTheme: (theme) => {
    localStorage.setItem('lifeos-theme', theme);
    set({ theme });
  },
  setUnits: (units) => {
    localStorage.setItem('lifeos-units', units);
    set({ units });
  },
  setNotifications: (notifs) => set((state) => {
    const newNotifs = { ...state.notifications, ...notifs };
    localStorage.setItem('lifeos-notifications', JSON.stringify(newNotifs));
    return { notifications: newNotifs };
  }),
  setGoogleFitTokens: (tokens) => {
    if (tokens) {
      localStorage.setItem('lifeos-google-fit-tokens', JSON.stringify(tokens));
      set({ googleFitTokens: tokens, isGoogleFitConnected: true });
    } else {
      localStorage.removeItem('lifeos-google-fit-tokens');
      set({ googleFitTokens: null, isGoogleFitConnected: false });
    }
  },
  setDemoMode: (enabled) => {
    localStorage.setItem('lifeos-demo-mode', String(enabled));
    set({ demoMode: enabled });
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
      localStorage.removeItem('lifeos-google-fit-tokens');
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
}));
