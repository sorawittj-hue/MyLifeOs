import Dexie, { type Table } from 'dexie';

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

export interface FastingSession {
  id?: number;
  startTime: number;
  endTime?: number;
  protocol: string;
  completed: number; // 0 for false, 1 for true
}

export interface FoodLog {
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

export interface WaterLog {
  id?: number;
  date: string;
  amountMl: number;
}

export interface StepLog {
  id?: number;
  date: string;
  count: number;
  source?: string;
}

export interface Workout {
  id?: number;
  date: string;
  name: string;
  duration: number;
  notes?: string;
}

export interface WorkoutSet {
  id?: number;
  workoutId: number;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weightKg: number;
}

export interface BodyMetric {
  id?: number;
  date: string;
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
}

export interface SleepLog {
  id?: number;
  date: string;
  bedtime: string;
  wakeTime: string;
  quality: number;
  source?: string;
}

export interface Habit {
  id?: number;
  name: string;
  frequency: 'daily' | 'weekly';
  color: string;
  icon: string;
  createdAt: number;
}

export interface HabitCompletion {
  id?: number;
  habitId: number;
  date: string;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface Vital {
  id?: number;
  date: string;
  time: string;
  type: 'blood_pressure' | 'heart_rate' | 'glucose' | 'oxygen';
  value1: number; // Systolic or HR or Glucose or O2
  value2?: number; // Diastolic
  unit: string;
  notes?: string;
  source?: string;
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

  constructor() {
    super('LifeOSDatabase');
    this.version(4).stores({
      users: '++id',
      fastingSessions: '++id, startTime, completed',
      foodLogs: '++id, date',
      waterLogs: '++id, date',
      workouts: '++id, date',
      workoutSets: '++id, workoutId',
      bodyMetrics: '++id, date',
      sleepLogs: '++id, date',
      habits: '++id, name',
      habitCompletions: '++id, habitId, date',
      chatMessages: '++id, timestamp',
      vitals: '++id, date, type',
      stepLogs: '++id, date'
    });
  }
}

export const db = new LifeOSDatabase();
