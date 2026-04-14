// ── MiniMax AI Integration ────────────────────────────────────
// All requests go through /api/ai/chat (backend proxy)
// so the API key is NEVER exposed in the browser bundle.

import { User, FoodLog, BodyMetric, Vital } from './db';
import { RecoveryResult, StrainResult, HabitCorrelation } from './healthAlgorithms';

// ── Context Types ─────────────────────────────────────────────

export interface AICoachContext {
  user: User | null;
  todayFood: FoodLog[];
  recentWeight: BodyMetric[];
  recentVitals: Vital[];
  // Health analytics
  recovery?: RecoveryResult | null;
  strain?: StrainResult | null;
  habitCorrelations?: HabitCorrelation[];
}

const MINIMAX_API_KEY = 'sk-api-3tsdmeTvUWFYAqgWdAsMCrH4OuFnymWN7nnVS3frQO5jXaW1ibOtBPmNVy3_FnZ4eUyf3YOzgTLt2HWW6VNwUteJN7bIgamGONlxWVOpgC1ghNe_6cH977c';
const MINIMAX_BASE_URL = 'https://api.minimax.io/v1'; // International endpoint
const MINIMAX_MODELS = ['MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-M2'];

// ── Core Chat — tries backend proxy first, falls back to direct call ──

async function minimaxChat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  temperature = 0.7
): Promise<string> {
  // 1. Try backend proxy (keeps key server-side in production)
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
    if (proxyRes.status !== 404) {
      const err = await proxyRes.text();
      throw new Error(`Proxy error ${proxyRes.status}: ${err}`);
    }
    // 404 = server not restarted yet → fall through to direct call
    console.warn('[AI] Proxy 404 — falling back to direct MiniMax call');
  } catch (e: any) {
    if (!e.message?.includes('Proxy error')) {
      console.warn('[AI] Proxy unreachable — falling back to direct call', e.message);
    } else {
      throw e;
    }
  }

  // 2. Direct call fallback (tries models in order)
  let lastErr = '';
  for (const model of MINIMAX_MODELS) {
    try {
      const res = await fetch(`${MINIMAX_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens: 1024 }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'ไม่มีเนื้อหา';
      }
      lastErr = `${res.status} ${res.statusText}`;
      if (res.status === 401 || res.status === 403) break;
    } catch (e: any) {
      lastErr = e.message;
    }
  }
  throw new Error(`MiniMax all models failed: ${lastErr}`);
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

    const habitSection = context.habitCorrelations && context.habitCorrelations.length > 0
      ? `HABIT CORRELATIONS:\n${context.habitCorrelations.map(h => `- ${h.habitName}: ${h.recoveryImpactPct > 0 ? '+' : ''}${h.recoveryImpactPct}% impact on recovery`).join('\n')}`
      : '';

    const systemInstruction = `You are LifeOS AI Health Coach — a world-class health, longevity, and performance expert powered by MiniMax AI.

USER PROFILE:
${JSON.stringify(context.user, null, 2)}

TODAY'S HEALTH ANALYTICS:
${recoverySection}
${strainSection}
${habitSection}

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

// ── Daily Insight Generator ───────────────────────────────────

export async function generateDailyInsight(context: {
  recovery: RecoveryResult | null;
  strain: StrainResult | null;
  sleepHours: number;
  steps: number;
  calories: number;
  habitCorrelations: HabitCorrelation[];
}): Promise<string> {
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
    if (context.recovery && context.recovery.score < 40) {
      return 'Recovery ของคุณต่ำกว่าเกณฑ์วันนี้ ลองเพิ่มเวลานอนและลดความเข้มข้นการออกกำลังกายลงดูครับ';
    }
    return 'วันนี้เป็นวันที่ดีสำหรับการดูแลสุขภาพ รักษาความสม่ำเสมอไว้เพื่อผลลัพธ์ที่ดีในระยะยาวครับ';
  }
}
