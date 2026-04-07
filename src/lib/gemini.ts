import { GoogleGenAI } from "@google/genai";
import { User, FoodLog, BodyMetric, Vital } from "./db";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface AICoachContext {
  user: User | null;
  todayFood: FoodLog[];
  recentWeight: BodyMetric[];
  recentVitals: Vital[];
}

export async function getAICoachResponse(prompt: string, context: AICoachContext) {
  if (!ai) return "กรุณาตั้งค่า VITE_GEMINI_API_KEY ในไฟล์ .env เพื่อใช้งาน AI Coach";
  try {
    const model = "gemini-3-flash-preview";
    const systemInstruction = `You are LifeOS AI Health Coach, a world-class health and longevity expert.
    
    USER CONTEXT:
    ${JSON.stringify(context)}
    
    GUIDELINES:
    1. Provide concise, evidence-based, and actionable advice.
    2. Analyze trends in the user's data (weight, nutrition, vitals).
    3. Be encouraging but direct about health risks.
    4. Use Markdown for clarity (bolding, lists).
    5. If data is missing, suggest what the user should track.
    6. Always respond in the language the user is using (Thai or English).
    
    GOAL: Help the user reach their target weight and optimize metabolic health.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "ขออภัยครับ ผมไม่สามารถประมวลผลคำขอนี้ได้ในขณะนี้";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "ขออภัยครับ ระบบ AI กำลังมีปัญหาขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";
  }
}

export async function generateDailyInsight(context: any) {
  if (!ai) return "ลองดื่มน้ำเพิ่มขึ้นอีกนิดในวันนี้ เพื่อช่วยให้ร่างกายสดชื่นและเผาผลาญได้ดีขึ้นครับ";
  try {
    const model = "gemini-3-flash-preview";
    const systemInstruction = `You are LifeOS AI Health Coach.
    Analyze the user's data for the last 24-48 hours and provide ONE powerful, personalized insight (max 2 sentences).
    Focus on: Nutrition gaps, activity levels, sleep quality, or vital trends.
    Language: Thai.
    
    DATA:
    ${JSON.stringify(context)}`;

    const response = await ai.models.generateContent({
      model,
      contents: "Generate a daily health insight based on my data.",
      config: {
        systemInstruction,
        temperature: 0.8,
      },
    });

    return response.text || "ลองดื่มน้ำเพิ่มขึ้นอีกนิดในวันนี้ เพื่อช่วยให้ร่างกายสดชื่นและเผาผลาญได้ดีขึ้นครับ";
  } catch (error) {
    return "วันนี้เป็นวันที่ดีที่จะเริ่มต้นดูแลตัวเอง ลองเดินเพิ่มอีกสัก 1,000 ก้าวดูนะครับ";
  }
}
