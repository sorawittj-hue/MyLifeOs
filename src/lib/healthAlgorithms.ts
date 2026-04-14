// ── MyLifeOS Health Algorithms ───────────────────────────────
// Whoop-inspired Recovery & Strain engine
// ─────────────────────────────────────────────────────────────

// ── Input Types ──────────────────────────────────────────────

export interface RecoveryInput {
  sleepDurationHours: number;  // calculated from bedtime→wakeTime
  sleepQuality: number;         // 1–5 from SleepLog.quality
  restingHeartRate: number;     // bpm from Vitals (type='heart_rate')
  hrv: number | null;           // ms; simulated if not available
}

export interface StrainInput {
  workoutDurationMinutes: number; // sum of today's Workout.duration
  workoutNames: string[];          // all workout names today
  stepsCount: number;              // from StepLog.count
}

export interface HabitCorrelation {
  habitName: string;
  recoveryImpactPct: number;   // +ve = boosts recovery, -ve = hurts it
  sampleSize: number;
  color: string;
}

// ── Output Types ─────────────────────────────────────────────

export interface RecoveryResult {
  score: number;         // 0–100
  label: 'Low' | 'Moderate' | 'High';
  labelTh: string;
  color: string;         // hex
  gradientFrom: string;
  gradientTo: string;
  breakdown: {
    sleep: number;       // pts from sleep
    quality: number;     // pts from quality
    rhr: number;         // pts from RHR
    hrv: number;         // pts from HRV
  };
}

export interface StrainResult {
  score: number;           // 0–21
  zone: 'Recovery' | 'Moderate' | 'High' | 'Peak';
  zoneTh: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
}

// ── Recovery Score (0–100) ────────────────────────────────────

export function calculateRecoveryScore(input: RecoveryInput): RecoveryResult {
  const { sleepDurationHours, sleepQuality, restingHeartRate } = input;

  // Simulate HRV from RHR if not provided (higher RHR → lower HRV)
  const hrv = input.hrv ?? Math.max(20, 85 - restingHeartRate + (Math.random() * 10 - 5));

  // 1. Sleep Duration (max 40 pts)
  let sleepPts = 0;
  if (sleepDurationHours >= 8) sleepPts = 40;
  else if (sleepDurationHours >= 7) sleepPts = 35;
  else if (sleepDurationHours >= 6) sleepPts = 25;
  else if (sleepDurationHours >= 5) sleepPts = 15;
  else sleepPts = 0;

  // 2. Sleep Quality (max 25 pts)
  const qualityPts = Math.round((sleepQuality / 5) * 25);

  // 3. Resting HR (max 20 pts)
  let rhrPts = 0;
  if (restingHeartRate < 50) rhrPts = 20;
  else if (restingHeartRate < 60) rhrPts = 17;
  else if (restingHeartRate < 70) rhrPts = 13;
  else if (restingHeartRate < 80) rhrPts = 8;
  else if (restingHeartRate < 90) rhrPts = 4;
  else rhrPts = 0;

  // 4. HRV (max 15 pts)
  let hrvPts = 0;
  if (hrv > 70) hrvPts = 15;
  else if (hrv > 50) hrvPts = 12;
  else if (hrv > 35) hrvPts = 8;
  else if (hrv > 20) hrvPts = 4;
  else hrvPts = 0;

  const score = Math.min(100, sleepPts + qualityPts + rhrPts + hrvPts);

  let label: RecoveryResult['label'];
  let labelTh: string;
  let color: string;
  let gradientFrom: string;
  let gradientTo: string;

  if (score >= 67) {
    label = 'High';
    labelTh = 'ฟื้นตัวดี';
    color = '#22c55e';
    gradientFrom = '#16a34a';
    gradientTo = '#4ade80';
  } else if (score >= 34) {
    label = 'Moderate';
    labelTh = 'ปานกลาง';
    color = '#f59e0b';
    gradientFrom = '#d97706';
    gradientTo = '#fbbf24';
  } else {
    label = 'Low';
    labelTh = 'ฟื้นตัวต่ำ';
    color = '#ef4444';
    gradientFrom = '#dc2626';
    gradientTo = '#f87171';
  }

  return {
    score,
    label,
    labelTh,
    color,
    gradientFrom,
    gradientTo,
    breakdown: { sleep: sleepPts, quality: qualityPts, rhr: rhrPts, hrv: hrvPts },
  };
}

// ── Strain Score (0–21, Whoop scale) ─────────────────────────

const INTENSITY_MAP: Record<string, number> = {
  yoga: 0.55,
  stretch: 0.5,
  walk: 0.6,
  walking: 0.6,
  mobility: 0.55,
  hiit: 1.45,
  cardio: 1.3,
  run: 1.35,
  running: 1.35,
  cycling: 1.2,
  swim: 1.25,
  swimming: 1.25,
  strength: 1.15,
  'push pull legs': 1.2,
  'full body': 1.1,
  deadlift: 1.25,
  squat: 1.2,
  'bench press': 1.1,
};

function getIntensityMultiplier(workoutNames: string[]): number {
  if (workoutNames.length === 0) return 1.0;
  const combined = workoutNames.join(' ').toLowerCase();
  for (const [key, mult] of Object.entries(INTENSITY_MAP)) {
    if (combined.includes(key)) return mult;
  }
  return 1.0;
}

function durationToStrain(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 20) return 1;
  if (minutes < 35) return 3;
  if (minutes < 50) return 5;
  if (minutes < 65) return 8;
  if (minutes < 90) return 11;
  if (minutes < 120) return 14;
  return 16;
}

export function calculateStrainScore(input: StrainInput): StrainResult {
  const { workoutDurationMinutes, workoutNames, stepsCount } = input;

  const baseStrain = durationToStrain(workoutDurationMinutes);
  const intensityMult = getIntensityMultiplier(workoutNames);
  const workoutStrain = Math.round(baseStrain * intensityMult);

  // Daily activity contribution: steps / 10000 * 3  (max 3 pts)
  const activityStrain = Math.min(3, (stepsCount / 10000) * 3);

  const score = Math.min(21, Math.round(workoutStrain + activityStrain));

  let zone: StrainResult['zone'];
  let zoneTh: string;
  let color: string;
  let gradientFrom: string;
  let gradientTo: string;

  if (score >= 18) {
    zone = 'Peak';
    zoneTh = 'สูงสุด';
    color = '#ef4444';
    gradientFrom = '#dc2626';
    gradientTo = '#f87171';
  } else if (score >= 14) {
    zone = 'High';
    zoneTh = 'สูง';
    color = '#f97316';
    gradientFrom = '#ea580c';
    gradientTo = '#fb923c';
  } else if (score >= 10) {
    zone = 'Moderate';
    zoneTh = 'ปานกลาง';
    color = '#3b82f6';
    gradientFrom = '#2563eb';
    gradientTo = '#60a5fa';
  } else {
    zone = 'Recovery';
    zoneTh = 'พักฟื้น';
    color = '#8b5cf6';
    gradientFrom = '#7c3aed';
    gradientTo = '#a78bfa';
  }

  return { score, zone, zoneTh, color, gradientFrom, gradientTo };
}

// ── Habit–Recovery Correlation ────────────────────────────────
// Takes 14 days of history and computes per-habit recovery impact.
// Each entry: { date, habitsDone: string[], recoveryScore: number }

export interface DaySnapshot {
  date: string;
  habitsDone: string[];    // habit names completed that day
  recoveryScore: number;   // 0–100
}

export function computeHabitCorrelations(
  snapshots: DaySnapshot[],
  habitNames: string[],
  habitColors: Record<string, string>
): HabitCorrelation[] {
  const results: HabitCorrelation[] = [];

  for (const name of habitNames) {
    const with_habit: number[] = [];
    const without_habit: number[] = [];

    for (const snap of snapshots) {
      if (snap.habitsDone.includes(name)) {
        with_habit.push(snap.recoveryScore);
      } else {
        without_habit.push(snap.recoveryScore);
      }
    }

    if (with_habit.length < 2 || without_habit.length < 2) continue;

    const avgWith = with_habit.reduce((a, b) => a + b, 0) / with_habit.length;
    const avgWithout = without_habit.reduce((a, b) => a + b, 0) / without_habit.length;
    const impact = Math.round(avgWith - avgWithout);

    results.push({
      habitName: name,
      recoveryImpactPct: impact,
      sampleSize: with_habit.length,
      color: habitColors[name] || '#22c55e',
    });
  }

  // Sort by absolute impact, strongest first
  return results
    .filter(r => Math.abs(r.recoveryImpactPct) >= 2)
    .sort((a, b) => Math.abs(b.recoveryImpactPct) - Math.abs(a.recoveryImpactPct))
    .slice(0, 4);
}

// ── AI Recommendation ─────────────────────────────────────────

export function getRecoveryRecommendation(
  recovery: RecoveryResult,
  strain: StrainResult
): string {
  if (recovery.score < 34) {
    if (strain.score > 13) {
      return 'Recovery ต่ำมาก ควรพักผ่อนหรือทำโยคะเบาๆ แทนการออกกำลังกายหนัก';
    }
    return 'ร่างกายต้องการการพักฟื้น ลองนอนหลับพักผ่อนให้เพียงพอและลดความเครียดลง';
  }
  if (recovery.score < 67) {
    if (strain.score > 16) {
      return 'Recovery ปานกลาง ลองลดความหนักของการออกกำลังกายลงสักหน่อย';
    }
    return 'วันที่ดีสำหรับการออกกำลังกายปานกลาง เน้นรูปแบบที่สนุกสนาน';
  }
  if (strain.score < 10) {
    return 'Recovery ดีมาก! ร่างกายพร้อมรับภาระหนัก ลองเพิ่มความเข้มข้นการออกกำลังกายวันนี้';
  }
  return 'Recovery ดีและ Strain อยู่ในระดับที่เหมาะสม คงความต่อเนื่องนี้ไว้!';
}
