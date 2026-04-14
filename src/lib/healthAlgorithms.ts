// ── MyLifeOS Advanced Health Engine ──────────────────────────────
// Edge Cognitive/Physical predictive engine
// ─────────────────────────────────────────────────────────────

// ── Input Types ──────────────────────────────────────────────

export interface BaselineData {
  rhr: number[];
  hrv: number[];
  sleep: number[];
}

export interface RecoveryInput {
  sleepDurationHours: number;
  sleepQuality: number; // 1-5
  restingHeartRate: number;
  hrv: number | null;
}

export interface StrainInput {
  workoutDurationMinutes: number;
  workoutNames: string[];
  stepsCount: number;
}

export interface CognitiveInput {
  deepWorkMinutes: number;
  meetingHours: number;
  stressSelfReport: number; // 1-10
}

export interface HabitCorrelation {
  habitName: string;
  recoveryImpactPct: number;
  sampleSize: number;
  color: string;
  predictiveInsight?: string; // New Bayesian predictive insight
}

// ── Output Types ─────────────────────────────────────────────

export interface RecoveryResult {
  score: number; // 0-100
  label: 'Low' | 'Moderate' | 'High';
  labelTh: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  zScores: { // Standard deviations from personal rolling baseline
    hrv: number;
    rhr: number;
    sleep: number;
  };
  breakdown: { // Retained for backwards compatibility if needed
    sleep: number;
    quality: number;
    rhr: number;
    hrv: number;
  };
}

export interface SleepPerformanceResult {
  score: number; // 0-100%
  sleepNeed: number; // calculated sleep need in hours
  actualSleep: number; // actual sleep in hours
  label: 'Poor' | 'Fair' | 'Good' | 'Optimal';
  labelTh: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
}

export interface StrainResult {
  score: number; // Matches totalAllostaticLoad (for backwards compat)
  physicalScore: number;     // 0-21
  cognitiveScore: number;    // 0-21
  totalAllostaticLoad: number; // 0-21 (Combined)
  zone: 'Recovery' | 'Moderate' | 'High' | 'Overreaching';
  zoneTh: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
}

// ── Utility: Z-Score Calculation ─────────────────────────────

function getZScore(val: number, arr: number[], invert: boolean = false): number {
  if (!arr || arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (arr.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  let z = (val - mean) / stdDev;
  return invert ? -z : z; // e.g., higher RHR is worse, so invert Z for score calculation
}

// ── Sleep Performance Engine ─────────────────────────────────

export function calculateSleepPerformance(
  actualSleepHours: number,
  previousStrainScore: number = 10,
  sleepDebtHours: number = 0
): SleepPerformanceResult {
  let sleepNeed = 8.0; // Baseline 8 hours
  
  if (previousStrainScore > 10) {
    sleepNeed += ((previousStrainScore - 10) / 11) * 1.5;
  }
  
  sleepNeed += sleepDebtHours;
  
  const score = Math.min(100, Math.max(0, Math.round((actualSleepHours / sleepNeed) * 100)));
  
  let label: SleepPerformanceResult['label'];
  let labelTh: string;
  let color: string;
  let gradientFrom: string;
  let gradientTo: string;
  
  if (score >= 85) {
    label = 'Optimal';
    labelTh = 'ดีเยี่ยม';
    color = '#3b82f6'; // Blue
    gradientFrom = '#2563eb';
    gradientTo = '#60a5fa';
  } else if (score >= 70) {
    label = 'Good';
    labelTh = 'ดี';
    color = '#14b8a6'; // Teal
    gradientFrom = '#0d9488';
    gradientTo = '#2dd4bf';
  } else if (score >= 50) {
    label = 'Fair';
    labelTh = 'พอใช้';
    color = '#f59e0b'; // Amber
    gradientFrom = '#d97706';
    gradientTo = '#fbbf24';
  } else {
    label = 'Poor';
    labelTh = 'ควรปรับปรุง';
    color = '#ef4444'; // Red
    gradientFrom = '#dc2626';
    gradientTo = '#f87171';
  }
  
  return {
    score, 
    sleepNeed: parseFloat(sleepNeed.toFixed(1)), 
    actualSleep: parseFloat(actualSleepHours.toFixed(1)),
    label, 
    labelTh, 
    color, 
    gradientFrom, 
    gradientTo
  };
}

// ── Recovery Score Engine ────────────────────────────────────

export function calculateRecoveryScore(input: RecoveryInput, baseline?: BaselineData): RecoveryResult {
  const { sleepDurationHours, sleepQuality, restingHeartRate } = input;
  const hrv = input.hrv || Math.max(20, 85 - restingHeartRate + (Math.random() * 10 - 5));

  // Default baselines if none provided (avoids breaking on day 1 or missing history)
  const blHrv = baseline?.hrv?.length ? baseline.hrv : [hrv];
  const blRhr = baseline?.rhr?.length ? baseline.rhr : [restingHeartRate];
  const blSleep = baseline?.sleep?.length ? baseline.sleep : [sleepDurationHours];

  // Calculate Z-Scores
  // HRV: higher is better (+Z is good)
  const zHrv = getZScore(hrv, blHrv, false);
  // RHR: lower is better (-Z is good, so we invert)
  const zRhr = getZScore(restingHeartRate, blRhr, true);
  // Sleep: higher is better (+Z is good)
  const zSleep = getZScore(sleepDurationHours, blSleep, false);

  // Normalize Z-scores to a 0-100 system.
  // Base recovery sits at ~50% for exactly average days (-0 Z-score), modulated by quality.
  
  // Mapping -2..+2 stdDev to 0..35 pts
  const hrvComponent = Math.min(Math.max((zHrv + 2) / 4, 0), 1) * 35;
  const rhrComponent = Math.min(Math.max((zRhr + 2) / 4, 0), 1) * 35;
  
  // Sleep uses combination of duration Z-score and absolute quality (1-5)
  const sleepZComponent = Math.min(Math.max((zSleep + 2) / 4, 0), 1) * 15;
  const sleepQualityComponent = (sleepQuality / 5) * 15;
  
  let score = Math.round(hrvComponent + rhrComponent + sleepZComponent + sleepQualityComponent);
  score = Math.min(Math.max(score, 0), 100);

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
    zScores: {
      hrv: parseFloat(zHrv.toFixed(2)),
      rhr: parseFloat(zRhr.toFixed(2)),
      sleep: parseFloat(zSleep.toFixed(2))
    },
    breakdown: { // fallback for backwards compatibility if still used
      sleep: Math.round(sleepZComponent),
      quality: Math.round(sleepQualityComponent),
      rhr: Math.round(rhrComponent),
      hrv: Math.round(hrvComponent)
    }
  };
}

// ── Strain Score Engine ──────────────────────────────────────

const INTENSITY_MAP: Record<string, number> = {
  yoga: 0.55, stretch: 0.5, walk: 0.6, walking: 0.6, mobility: 0.55,
  hiit: 1.45, cardio: 1.3, run: 1.35, running: 1.35, cycling: 1.2,
  swim: 1.25, swimming: 1.25, strength: 1.15, 'push pull legs': 1.2,
  'full body': 1.1, deadlift: 1.25, squat: 1.2, 'bench press': 1.1,
};

function getIntensityMultiplier(workoutNames: string[]): number {
  if (!workoutNames || workoutNames.length === 0) return 1.0;
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

// Mental Strain Calculation
function calculateCognitiveStrain(cognitive: CognitiveInput): number {
  // Deep work: Non-linear taxation. > 120 mins starts scaling up. Max ~10 Strain.
  const dwStrain = Math.min(10, Math.pow(cognitive.deepWorkMinutes / 60, 1.2) * 1.5);
  // Meetings: High context switching. 4 hours = ~6 Strain.
  const meetingStrain = Math.min(8, cognitive.meetingHours * 1.5);
  // Stress Self Report (1-10): Can add up to 8 points of base cognitive strain.
  const stressStrain = (cognitive.stressSelfReport / 10) * 8;

  // Combination with natural ceiling
  return Math.min(21, dwStrain + meetingStrain + stressStrain);
}

export function calculateStrainScore(physical: StrainInput, cognitive?: CognitiveInput): StrainResult {
  // 1. Physical Strain
  const baseStrain = durationToStrain(physical.workoutDurationMinutes);
  const intensityMult = getIntensityMultiplier(physical.workoutNames);
  const workoutStrain = baseStrain * intensityMult;
  const activityStrain = Math.min(3, (physical.stepsCount / 10000) * 3);
  const physicalScore = Math.min(21, workoutStrain + activityStrain);

  // 2. Cognitive Strain
  const defaultCognitive: CognitiveInput = { deepWorkMinutes: 0, meetingHours: 0, stressSelfReport: 3 };
  const cognitiveScore = calculateCognitiveStrain(cognitive || defaultCognitive);

  // 3. Total Allostatic Load (Combines physical & cognitive using vector addition pattern)
  const totalAllostaticLoad = Math.min(21, Math.sqrt(Math.pow(physicalScore, 2) + Math.pow(cognitiveScore, 2)));

  const score = Math.round(totalAllostaticLoad);

  let zone: StrainResult['zone'];
  let zoneTh: string;
  let color: string;
  let gradientFrom: string;
  let gradientTo: string;

  if (score >= 18) {
    zone = 'Overreaching';
    zoneTh = 'โอเวอร์สเตรน';
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

  return { 
    score,
    physicalScore: parseFloat(physicalScore.toFixed(1)), 
    cognitiveScore: parseFloat(cognitiveScore.toFixed(1)), 
    totalAllostaticLoad: parseFloat(totalAllostaticLoad.toFixed(1)),
    zone, zoneTh, color, gradientFrom, gradientTo 
  };
}

// ── Bayesian Habit–Recovery Correlation ───────────────────────

export interface DaySnapshot {
  date: string;
  habitsDone: string[];
  recoveryScore: number;
  cognitiveStrain?: number; // Adds context to predictions
}

export function computeHabitCorrelations(
  snapshots: DaySnapshot[],
  habitNames: string[],
  habitColors: Record<string, string>
): HabitCorrelation[] {
  const results: HabitCorrelation[] = [];
  const HIGH_RECOVERY_THRESHOLD = 67;
  const HIGH_COGNITIVE_STRAIN_THRESHOLD = 8;
  
  const totalDays = snapshots.length;
  if (totalDays === 0) return [];
  
  // Prior: P(High Recovery)
  const highRecoveryDays = snapshots.filter(s => s.recoveryScore >= HIGH_RECOVERY_THRESHOLD);
  // Default to 50% prior if not enough data to prevent extreme shifts
  const priorHighRecov = totalDays >= 3 ? (highRecoveryDays.length / totalDays) : 0.5;

  for (const name of habitNames) {
    const with_habit = snapshots.filter(s => s.habitsDone.includes(name));
    const without_habit = snapshots.filter(s => !s.habitsDone.includes(name));

    if (with_habit.length < 2 || without_habit.length < 2) continue;

    // Simple Difference in Means (for % display)
    const avgWith = with_habit.reduce((sum, s) => sum + s.recoveryScore, 0) / with_habit.length;
    const avgWithout = without_habit.reduce((sum, s) => sum + s.recoveryScore, 0) / without_habit.length;
    const impact = Math.round(avgWith - avgWithout);

    // ── Bayesian Predictive Insight ──
    let predictiveInsight = '';
    
    // P(High Recovery | Habit)
    const probHighRecov_GivenHabit = with_habit.filter(s => s.recoveryScore >= HIGH_RECOVERY_THRESHOLD).length / with_habit.length;
    
    // Evaluate under high cognitive strain
    const highCogStrainDays = snapshots.filter(s => (s.cognitiveStrain || 0) >= HIGH_COGNITIVE_STRAIN_THRESHOLD);
    const highCogStrain_withHabit = highCogStrainDays.filter(s => s.habitsDone.includes(name));
    
    if (highCogStrain_withHabit.length >= 2) {
      const probHighRecov_GivenHabit_AndHighCog = highCogStrain_withHabit.filter(s => s.recoveryScore >= HIGH_RECOVERY_THRESHOLD).length / highCogStrain_withHabit.length;
      const probDrop = Math.round((probHighRecov_GivenHabit - probHighRecov_GivenHabit_AndHighCog) * 100);
      
      if (probDrop > 20) {
        predictiveInsight = `หากทำนิสัยนี้ร่วมกับภาวะ **Cognitive Strain สูง** โอกาสที่ Recovery วันถัดไปจะดีลดลงถึง ${probDrop}%`;
      } else if (probHighRecov_GivenHabit_AndHighCog > priorHighRecov && probHighRecov_GivenHabit_AndHighCog > 0.6) {
        predictiveInsight = `นิสัยนี้มีผลอย่างมากในการ **ปกป้อง** Recovery ของคุณแม้ในวันที่มีความเครียดทางสมองสูง`;
      }
    }

    if (!predictiveInsight && probHighRecov_GivenHabit > (priorHighRecov + 0.2)) {
       predictiveInsight = `การทำสิ่งนี้เพิ่มโอกาสการฟื้นตัวโซนสีเขียวของคุณจาก ${Math.round(priorHighRecov*100)}% เป็น ${Math.round(probHighRecov_GivenHabit*100)}%`;
    }

    results.push({
      habitName: name,
      recoveryImpactPct: impact,
      sampleSize: with_habit.length,
      color: habitColors[name] || '#22c55e',
      predictiveInsight
    });
  }

  return results
    .filter(r => Math.abs(r.recoveryImpactPct) >= 2)
    .sort((a, b) => Math.abs(b.recoveryImpactPct) - Math.abs(a.recoveryImpactPct))
    .slice(0, 4);
}

// ── Agentic AI Interventions ──────────────────────────────────

export interface AgenticIntervention {
  actionType: 'calendar_block' | 'wind_down_routine' | 'fasting_adjustment' | 'workout_skip';
  rationale: string;
  uiPrompt: string;
}

export function generateAgenticInterventions(
  recovery: RecoveryResult,
  strain: StrainResult
): AgenticIntervention[] {
  const interventions: AgenticIntervention[] = [];

  // Low Recovery + High Cognitive Strain = Burnout risk
  if (recovery.score < 40 && strain.cognitiveScore > 10) {
    interventions.push({
      actionType: 'calendar_block',
      rationale: 'Z-Scores show suppressed HRV and high mental load.',
      uiPrompt: 'ระบบพบความเสี่ยงภาวะ Burnout ให้ระบบช่วยตั้ง Auto-Block ตารางงานช่วงเช้าพรุ่งนี้หรือไม่?'
    });
  }

  // High Physical Strain + Poor Sleep = Needs specific recovery protocol
  if (strain.physicalScore > 14 && recovery.zScores.sleep < -0.5) {
    interventions.push({
      actionType: 'wind_down_routine',
      rationale: 'Physical repair phase heavily compromised by sleep debt.',
      uiPrompt: 'ร่างกายสะสมโหลดไว้สูงแต่นอนตกเกณฑ์ ให้สร้างตาราง Wind-down คืนนี้ช่วยเสริมการฟื้นตัวไหม?'
    });
  }
  
  if (strain.totalAllostaticLoad > 18 && recovery.score < 50) {
      interventions.push({
          actionType: 'workout_skip',
          rationale: 'Allostatic load is exceptionally high.',
          uiPrompt: 'Total Allostatic Load สูงทะลุเกณฑ์ แนะนำให้ปรับเป็น Rest Day ให้บันทึกการปรับเปลี่ยนแผนเลยไหม?'
      });
  }

  return interventions;
}

// ── Legacy AI Recommendation (Fallback / General text) ───────────────

export function getRecoveryRecommendation(
  recovery: RecoveryResult,
  strain: StrainResult
): string {
  if (recovery.score < 34) {
    if (strain.score > 13) {
      return 'Recovery ต่ำมาก Allostatic Load ขึ้นสูง ควรพักผ่อนหรือทำกิจกรรมเบาๆ เพื่อฟื้นฟูระบบประสาท';
    }
    return 'ร่างกายอยู่ในช่วงอ่อนล้า ลองนอนหลับพักผ่อนชดเชยและลดกิจกรรมสภาวะความเครียด';
  }
  if (recovery.score < 67) {
    if (strain.score > 16) {
      return 'Recovery ระดับกลาง มีโหลดสะสมพอควร แนะนำให้ระวังอย่าเกินขีดจำกัดตัวเอง';
    }
    return 'สภาพร่างกายฟื้นตัวปานกลาง เป็นวันกำลังดีสำหรับการรักษาระดับการเทรน / ทำงาน';
  }
  if (strain.score < 10) {
    return 'Recovery ดีเยี่ยม! ค่า Z-Score ของร่างกายพร้อมเทคแอคชั่นและทนต่อระดับ Strain สูงแล้ววันนี้';
  }
  return 'ร่างกายรักษาสมดุล Allostatic Load ได้ยอดเยี่ยม คงความต่อเนื่องระดับนี้ไว้!';
}
