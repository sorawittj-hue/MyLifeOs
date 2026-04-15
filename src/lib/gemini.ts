// ── MiniMax AI Integration ────────────────────────────────────
// All requests go through /api/ai/chat (backend proxy)
// so the API key is NEVER exposed in the browser bundle.

import { User, FoodLog, BodyMetric, Vital } from './db';
import { RecoveryResult, StrainResult, HabitCorrelation, ReadinessPrediction, DaySnapshot } from './healthAlgorithms';

// ── Context Types ─────────────────────────────────────────────

export interface AICoachContext {
  user: User | null;
  todayFood: FoodLog[];
  recentWeight: BodyMetric[];
  recentVitals: Vital[];
  // Health analytics
  recovery?: RecoveryResult | null;
  strain?: StrainResult | null;
  tomorrowReadiness?: ReadinessPrediction | null;
  recentJournals?: any[];
  habitCorrelations?: HabitCorrelation[];
}

// Rate-limit tracking — prevent cascade 429s
let _rateLimitedUntil = 0;
const RATE_LIMIT_COOLDOWN_MS = 180_000; // 3 minute cooldown after a 429

// ── Core Chat — goes through backend proxy only ──
// API keys are kept server-side. No direct client calls.

async function minimaxChat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  temperature = 0.7
): Promise<string> {
  // Guard: if we were recently rate-limited, return a graceful message immediately
  if (Date.now() < _rateLimitedUntil) {
    console.warn('[AI] Still in rate-limit cooldown, skipping request');
    return 'พักหน่อยนะครับ 🌿 โค้ช AI กำลังพักชั่วคราว กรุณาลองใหม่ในอีกสักครู่';
  }

  try {
    const proxyRes = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, temperature }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      return data.content || 'ไม่มีเนื้อหา';
    }

    if (proxyRes.status === 429) {
      console.warn('[AI] Rate-limited (429) — entering cooldown');
      _rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      return 'พักหน่อยนะครับ 🌿 โค้ช AI ตอนนี้มีคนใช้งานเต็มระบบ กรุณาลองใหม่ในอีก 1 นาที';
    }

    if (proxyRes.status === 404) {
      console.warn('[AI] Proxy endpoint not found (404)');
      return 'ระบบ AI ยังไม่พร้อมใช้งาน กรุณาตรวจสอบการตั้งค่า Backend';
    }

    const errText = await proxyRes.text();
    throw new Error(`Proxy error ${proxyRes.status}: ${errText}`);
  } catch (e: any) {
    if (e.message?.includes('Proxy error')) {
      throw e;
    }
    // Network error / proxy unreachable
    console.warn('[AI] Proxy unreachable:', e.message);
    return 'ไม่สามารถเชื่อมต่อกับ AI ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต';
  }
}

// ── AI Coach Response ─────────────────────────────────────────

export async function getAICoachResponse(prompt: string, context: AICoachContext): Promise<string> {
  try {
    const recoverySection = context.recovery
      ? `RECOVERY ZONE: ${context.recovery.score}/100 (${context.recovery.label} — ${context.recovery.labelTh})
         Z-Scores (Std Dev from baseline): Sleep ${context.recovery.zScores.sleep}σ | RHR ${context.recovery.zScores.rhr}σ | HRV ${context.recovery.zScores.hrv}σ`
      : 'Recovery data: not available yet';

    const strainSection = context.strain
      ? `ALLOSTATIC LOAD: ${context.strain.totalAllostaticLoad}/21 (${context.strain.zone} — ${context.strain.zoneTh})
         Breakdown: Physical Strain = ${context.strain.physicalScore}/21 | Cognitive/Mental Strain = ${context.strain.cognitiveScore}/21`
      : 'Strain data: not available yet';

    const readinessSection = context.tomorrowReadiness
      ? `TOMORROW'S READINESS PREDICTION: ${context.tomorrowReadiness.score}/100 (${context.tomorrowReadiness.labelTh})
         Trend: ${context.tomorrowReadiness.trend}`
      : 'Readiness Prediction: not available';

    const journalSection = context.recentJournals && context.recentJournals.length > 0
      ? `RECENT JOURNAL ENTRIES (Self-Reported Behaviors):
         ${JSON.stringify(context.recentJournals.slice(0, 3), null, 2)}`
      : '';

    const habitSection = context.habitCorrelations && context.habitCorrelations.length > 0
      ? `HABIT CORRELATIONS:\n${context.habitCorrelations.map(h => `- ${h.habitName}: ${h.recoveryImpactPct > 0 ? '+' : ''}${h.recoveryImpactPct}% impact on recovery`).join('\n')}`
      : '';

    const systemInstruction = `You are LifeOS AI Health Coach — a world-class health, longevity, and performance expert powered by MiniMax AI.

USER PROFILE:
${JSON.stringify(context.user, null, 2)}

TODAY'S HEALTH ANALYTICS:
${recoverySection}
${strainSection}
${readinessSection}
${habitSection}

${journalSection}

TODAY'S NUTRITION (${context.todayFood.length} items logged):
Total calories: ${context.todayFood.reduce((s, f) => s + f.calories, 0)} kcal

RECENT VITALS:
${JSON.stringify(context.recentVitals.slice(0, 5), null, 2)}

GUIDELINES:
1. You now operate using advanced Z-Score baselines, Cognitive Strain, and Bayesian Predictive Habit Data.
2. If Cognitive Strain > 10, strongly advise wind-down routines and highlight burnout risks independently of physical strain.
3. If Total Allostatic Load > 16, enforce aggressive rest and block high-stress tasks.
4. Reference specific Bayesian habit correlation predictions if the user asks about habits.
5. Emphasize standard deviation (σ) impacts—e.g., "HRV drops -1.5σ means your nervous system is in fight-or-flight."
6. Provide Agentic, actionable commands. Use Markdown for formatting.
7. Always respond in Thai language (or English if user writes in English).

GOAL: Act as the ultimate predictive health analyst advising an elite performer.`;

    return await minimaxChat([
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt },
    ], 0.7);
  } catch (error) {
    console.error('AI Coach Error:', error);
    return 'ขออภัยครับ ระบบ AI กำลังมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้งในอีกสักครู่';
  }
}

// ── Smart Local Insight Generator ─────────────────────────────
// Generates high-quality personalized health insight WITHOUT AI
// Used as primary when AI is rate-limited, and as fallback otherwise

function generateLocalInsight(context: {
  recovery: RecoveryResult | null;
  strain: StrainResult | null;
  sleepHours: number;
  steps: number;
  calories: number;
  habitCorrelations: HabitCorrelation[];
}): string {
  const r = context.recovery;
  const s = context.strain;
  const { sleepHours, steps, calories, habitCorrelations } = context;

  // Recovery-driven insights
  if (r && s) {
    if (r.score < 34 && s.totalAllostaticLoad > 14) {
      return `⚠️ Recovery ต่ำ (${r.score}%) + Allostatic Load สูง (${s.totalAllostaticLoad}/21) — ร่างกายรับโหลดมากเกินไป ควรพักฟื้นวันนี้ ลดความเข้มข้น 50% และนอนเพิ่มอย่างน้อย 1 ชม.`;
    }
    if (r.score < 34) {
      return `Recovery ${r.score}% ต่ำกว่าเกณฑ์${r.zScores.sleep < -0.5 ? ' — การนอนเป็นปัจจัยหลัก ลองเข้านอนเร็วขึ้น 30 นาที' : ''} แนะนำ Active Recovery เช่น ยืดเหยียด/โยคะ${sleepHours < 7 ? ` (นอนแค่ ${sleepHours} ชม. ต่ำกว่าเป้า)` : ''}`;
    }
    if (r.score >= 67 && s.score < 10) {
      return `💚 Recovery สูง ${r.score}% พร้อมรับ Strain! ร่างกายอยู่ในจุดที่ดีที่สุดสำหรับ HIIT หรือออกกำลังกายหนัก — อย่าเสียโอกาสวันนี้ 🔥`;
    }
    if (r.score >= 67 && s.score >= 14) {
      return `Recovery ${r.score}% ดีเยี่ยม แต่ Strain ${s.score}/21 สูงมากแล้ว ร่างกายใช้พลังงานเยอะ ระวังอย่า overtrain ควร cool-down ให้ดี`;
    }
    if (s.cognitiveScore > 10) {
      return `🧠 Cognitive Strain สูง (${s.cognitiveScore.toFixed(1)}) — สมองทำงานหนัก แนะนำพักเบรกทุก 45 นาที ดื่มน้ำ และลด screen time ก่อนนอน`;
    }
  }

  // Step-driven insights
  if (steps > 0 && steps < 3000) {
    return `เดินแค่ ${steps.toLocaleString()} ก้าวเอง ลองเพิ่มการเดินอีก ${(10000 - steps).toLocaleString()} ก้าวเพื่อให้ถึงเป้าหมาย — เริ่มจากเดินหลังมื้อเที่ยง 15 นาทีก็ช่วยได้มากครับ`;
  }
  if (steps >= 10000) {
    return `🎉 เดินถึงเป้า ${steps.toLocaleString()} ก้าว! Active lifestyle สำคัญมากสำหรับ metabolic health — รักษาระดับนี้ไว้ทุกวันเพื่อลด insulin resistance`;
  }

  // Sleep-driven insights
  if (sleepHours > 0 && sleepHours < 6) {
    return `😴 นอนแค่ ${sleepHours} ชม. — ต่ำกว่าเกณฑ์มาก Sleep debt จะสะสมและทำให้ Recovery ลดลง 15-25% ในวันถัดไป ลองเข้านอนก่อน 22:30 คืนนี้`;
  }
  if (sleepHours >= 8) {
    return `นอนได้ ${sleepHours} ชม. ดีเยี่ยม! การนอนเพียงพอช่วยเพิ่ม HRV และลด Resting HR — ร่างกายพร้อมสำหรับวันใหม่ 💪`;
  }

  // Habit-driven insights
  if (habitCorrelations.length > 0) {
    const best = habitCorrelations.find(h => h.recoveryImpactPct > 0);
    if (best) {
      return `📈 นิสัย "${best.habitName}" ช่วยเพิ่ม Recovery +${best.recoveryImpactPct}% จากข้อมูล 14 วัน — อย่าลืมทำต่อเนื่องวันนี้ด้วยนะครับ`;
    }
  }

  // General fallback with actual data
  if (calories > 0) {
    const targetCal = 2200;
    if (calories > targetCal * 1.2) {
      return `ทานไป ${calories.toLocaleString()} kcal (เกินเป้า ${targetCal} kcal) — ลองเพิ่มสัดส่วนผักและโปรตีนเพื่อความอิ่มนานโดยไม่ต้องเพิ่มแคลอรี่`;
    }
    return `ทานไป ${calories.toLocaleString()} kcal วันนี้ — ${calories < targetCal * 0.7 ? 'ยังน้อยอยู่ ระวังว่าร่างกายอาจขาดพลังงาน' : 'กำลังดีพอดี คุมเป้าหมายได้ดี'} 🍽️`;
  }

  return 'เริ่มต้นวันใหม่ด้วยการดื่มน้ำ 1 แก้ว และวางแผนมื้ออาหารวันนี้ให้สมดุลครับ 🌿';
}

// ── Daily Insight Generator ───────────────────────────────────

export async function generateDailyInsight(context: {
  recovery: RecoveryResult | null;
  strain: StrainResult | null;
  sleepHours: number;
  steps: number;
  calories: number;
  habitCorrelations: HabitCorrelation[];
}): Promise<string> {
  // If rate-limited, skip API call instantly and use local logic
  if (Date.now() < _rateLimitedUntil) {
    console.log('[AI] Rate-limited — using local insight engine');
    return generateLocalInsight(context);
  }

  try {
    const systemInstruction = `You are LifeOS AI Health Coach. Generate ONE powerful, personalized health insight in 1-2 sentences maximum.
Be specific about numbers. Language: THAI only. No markdown, plain text only.

DATA:
${JSON.stringify(context, null, 2)}`;

    return await minimaxChat([
      { role: 'system', content: systemInstruction },
      { role: 'user', content: 'สร้างข้อสรุปสุขภาพประจำวันของฉันหน่อย' },
    ], 0.75);
  } catch {
    // Use local engine as intelligent fallback
    return generateLocalInsight(context);
  }
}
