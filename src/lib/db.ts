import Dexie, { type Table } from 'dexie';

// ── Sync Status Type ─────────────────────────────────────────
export type SyncStatus = 'pending' | 'synced' | 'conflict';

// ── Base Syncable Interface ──────────────────────────────────
export interface SyncableRecord {
  updatedAt: number;       // Unix timestamp of last local modification
  syncStatus: SyncStatus;  // Track whether this record needs syncing
  _firebaseId?: string;    // Reference to Firebase document ID
}

export interface User {
  id?: number;
  name?: string;
  age: number;
  weight: number;
  height: number;
  gender: string;
  targetWeight: number;
  dailyCalorieTarget: number;
}

export interface FastingSession extends SyncableRecord {
  id?: number;
  startTime: number;
  endTime?: number;
  protocol: string;
  completed: number; // 0 for false, 1 for true
}

export interface FoodLog extends SyncableRecord {
  id?: number;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity: number;
}

export interface WaterLog extends SyncableRecord {
  id?: number;
  date: string;
  amountMl: number;
}

export interface StepLog extends SyncableRecord {
  id?: number;
  date: string;
  count: number;
  source?: string;
}

export interface Workout extends SyncableRecord {
  id?: number;
  date: string;
  name: string;
  duration: number;
  notes?: string;
}

export interface WorkoutSet extends SyncableRecord {
  id?: number;
  workoutId: number;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weightKg: number;
}

export interface BodyMetric extends SyncableRecord {
  id?: number;
  date: string;
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
}

export interface SleepLog extends SyncableRecord {
  id?: number;
  date: string;
  bedtime: string;
  wakeTime: string;
  quality: number;
  source?: string;
}

export interface Habit extends SyncableRecord {
  id?: number;
  name: string;
  frequency: 'daily' | 'weekly';
  color: string;
  icon: string;
  createdAt: number;
}

export interface HabitCompletion extends SyncableRecord {
  id?: number;
  habitId: number;
  date: string;
}

export interface ChatMessage extends SyncableRecord {
  id?: number;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface Vital extends SyncableRecord {
  id?: number;
  date: string;
  time: string;
  type: 'blood_pressure' | 'heart_rate' | 'glucose' | 'oxygen';
  value1: number;
  value2?: number;
  unit: string;
  notes?: string;
  source?: string;
}

// ── Gamification: Streaks & Badges ───────────────────────────
export interface StreakRecord {
  id?: number;
  type: 'hydration' | 'workout' | 'fasting' | 'habit' | 'sleep';
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string;  // yyyy-MM-dd
  updatedAt: number;
}

export interface Badge {
  id?: number;
  badgeId: string;       // e.g. 'hydration_7day', 'workout_30day'
  earnedAt: number;
  type: 'hydration' | 'workout' | 'fasting' | 'habit' | 'sleep';
}

// ── Dashboard Layout Preferences ─────────────────────────────
export interface DashboardWidget {
  id: string;
  order: number;
  visible: boolean;
  size: 'small' | 'medium' | 'large';
}

export interface DashboardLayout {
  id?: number;
  widgets: DashboardWidget[];
  updatedAt: number;
}

export class LifeOSDatabase extends Dexie {
  users!: Table<User>;
  fastingSessions!: Table<FastingSession>;
  foodLogs!: Table<FoodLog>;
  waterLogs!: Table<WaterLog>;
  workouts!: Table<Workout>;
  workoutSets!: Table<WorkoutSet>;
  bodyMetrics!: Table<BodyMetric>;
  sleepLogs!: Table<SleepLog>;
  habits!: Table<Habit>;
  habitCompletions!: Table<HabitCompletion>;
  chatMessages!: Table<ChatMessage>;
  vitals!: Table<Vital>;
  stepLogs!: Table<StepLog>;
  // Gamification tables
  streaks!: Table<StreakRecord>;
  badges!: Table<Badge>;
  // Dashboard layout
  dashboardLayouts!: Table<DashboardLayout>;

  constructor() {
    super('LifeOSDatabase');
    
    // Version 5: Add sync fields, gamification, and dashboard layout
    this.version(5).stores({
      users: '++id',
      fastingSessions: '++id, startTime, completed, syncStatus, updatedAt',
      foodLogs: '++id, date, syncStatus, updatedAt',
      waterLogs: '++id, date, syncStatus, updatedAt',
      workouts: '++id, date, syncStatus, updatedAt',
      workoutSets: '++id, workoutId, syncStatus, updatedAt',
      bodyMetrics: '++id, date, syncStatus, updatedAt',
      sleepLogs: '++id, date, syncStatus, updatedAt',
      habits: '++id, name, syncStatus, updatedAt',
      habitCompletions: '++id, habitId, date, syncStatus, updatedAt',
      chatMessages: '++id, timestamp, syncStatus, updatedAt',
      vitals: '++id, date, type, syncStatus, updatedAt',
      stepLogs: '++id, date, syncStatus, updatedAt',
      // Gamification
      streaks: '++id, type, lastCompletedDate',
      badges: '++id, badgeId, type, earnedAt',
      // Dashboard
      dashboardLayouts: '++id',
    }).upgrade(tx => {
      // Migrate existing records: add default sync fields
      const tables = [
        'fastingSessions', 'foodLogs', 'waterLogs', 'workouts', 
        'workoutSets', 'bodyMetrics', 'sleepLogs', 'habits', 
        'habitCompletions', 'chatMessages', 'vitals', 'stepLogs'
      ] as const;

      return Promise.all(
        tables.map(tableName => 
          tx.table(tableName).toCollection().modify(record => {
            if (!record.updatedAt) record.updatedAt = Date.now();
            if (!record.syncStatus) record.syncStatus = 'pending';
          })
        )
      );
    });
  }
}

export const db = new LifeOSDatabase();

// ── Helper: Create a record with sync metadata ──────────────
export function withSyncMeta<T>(data: T): T & SyncableRecord {
  return {
    ...data,
    updatedAt: Date.now(),
    syncStatus: 'pending' as SyncStatus,
  };
}

// ── Helper: Mark record as synced ────────────────────────────
export function markSynced<T extends SyncableRecord>(data: T): T {
  return {
    ...data,
    syncStatus: 'synced' as SyncStatus,
  };
}
