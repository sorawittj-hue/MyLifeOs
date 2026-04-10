/**
 * ── Health Integrations: Unified API for health data sources ──
 * 
 * Supports:
 * - Google Fit (existing, via REST API)
 * - Apple HealthKit (via window.webkit MessageHandler for WKWebView)
 * - Android Health Connect (via Web Activity/Capacitor bridge)
 * 
 * Architecture: Provider pattern with a unified HealthDataProvider interface.
 * Each platform implements the same interface for seamless data access.
 */

import { db, type StepLog, type SleepLog, type Vital, type BodyMetric, withSyncMeta } from './db';
import { format } from 'date-fns';

// ── Unified Health Data Types ────────────────────────────────
export interface HealthSteps {
  date: string;
  count: number;
  source: string;
}

export interface HealthSleep {
  date: string;
  bedtime: string;
  wakeTime: string;
  quality: number;
  source: string;
}

export interface HealthHeartRate {
  date: string;
  time: string;
  bpm: number;
  source: string;
}

export interface HealthWeight {
  date: string;
  weightKg: number;
  source: string;
}

// ── Provider Interface ───────────────────────────────────────
export interface HealthDataProvider {
  name: string;
  isAvailable(): boolean;
  requestPermission(): Promise<boolean>;
  getSteps(date: string): Promise<HealthSteps | null>;
  getSleep(date: string): Promise<HealthSleep | null>;
  getHeartRate(date: string): Promise<HealthHeartRate | null>;
  getWeight(date: string): Promise<HealthWeight | null>;
}

// ── Google Fit Provider (existing implementation) ─────────────
export class GoogleFitProvider implements HealthDataProvider {
  name = 'Google Fit';

  isAvailable(): boolean {
    // Checking if Google Fit tokens exist (set via OAuth flow)
    try {
      const stored = localStorage.getItem('lifeos-storage');
      if (stored) {
        const data = JSON.parse(stored);
        return !!data?.state?.isGoogleFitConnected;
      }
    } catch {}
    return false;
  }

  async requestPermission(): Promise<boolean> {
    // OAuth flow handled in Settings component
    return this.isAvailable();
  }

  async getSteps(date: string): Promise<HealthSteps | null> {
    const step = await db.stepLogs.where('date').equals(date).first();
    if (step) return { date, count: step.count, source: 'Google Fit' };
    return null;
  }

  async getSleep(date: string): Promise<HealthSleep | null> {
    const sleep = await db.sleepLogs.where('date').equals(date).first();
    if (sleep && sleep.source === 'google_fit') {
      return { date, bedtime: sleep.bedtime, wakeTime: sleep.wakeTime, quality: sleep.quality, source: 'Google Fit' };
    }
    return null;
  }

  async getHeartRate(date: string): Promise<HealthHeartRate | null> {
    const vitals = await db.vitals.where({ date, type: 'heart_rate' }).first();
    if (vitals) return { date, time: vitals.time, bpm: vitals.value1, source: 'Google Fit' };
    return null;
  }

  async getWeight(date: string): Promise<HealthWeight | null> {
    const metric = await db.bodyMetrics.where('date').equals(date).first();
    if (metric) return { date, weightKg: metric.weightKg, source: 'Google Fit' };
    return null;
  }
}

// ── Apple HealthKit Provider (WebKit bridge) ─────────────────
export class AppleHealthKitProvider implements HealthDataProvider {
  name = 'Apple Health';

  isAvailable(): boolean {
    // Check if running in a WKWebView with HealthKit bridge
    return !!(window as any).webkit?.messageHandlers?.healthKit;
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await this.sendMessage('requestPermission', {
        read: ['stepCount', 'heartRate', 'sleepAnalysis', 'bodyMass'],
      });
    } catch {
      return false;
    }
  }

  async getSteps(date: string): Promise<HealthSteps | null> {
    if (!this.isAvailable()) return null;
    try {
      const result = await this.sendMessage('getSteps', { date });
      if (result) return { date, count: result.count, source: 'Apple Health' };
    } catch {}
    return null;
  }

  async getSleep(date: string): Promise<HealthSleep | null> {
    if (!this.isAvailable()) return null;
    try {
      const result = await this.sendMessage('getSleep', { date });
      if (result) return { ...result, date, source: 'Apple Health' };
    } catch {}
    return null;
  }

  async getHeartRate(date: string): Promise<HealthHeartRate | null> {
    if (!this.isAvailable()) return null;
    try {
      const result = await this.sendMessage('getHeartRate', { date });
      if (result) return { date, time: result.time, bpm: result.bpm, source: 'Apple Health' };
    } catch {}
    return null;
  }

  async getWeight(date: string): Promise<HealthWeight | null> {
    if (!this.isAvailable()) return null;
    try {
      const result = await this.sendMessage('getWeight', { date });
      if (result) return { date, weightKg: result.weightKg, source: 'Apple Health' };
    } catch {}
    return null;
  }

  private sendMessage(action: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const callbackId = `healthKit_${Date.now()}`;
      (window as any)[callbackId] = (result: any) => {
        delete (window as any)[callbackId];
        resolve(result);
      };
      try {
        (window as any).webkit.messageHandlers.healthKit.postMessage({
          action, params, callbackId,
        });
      } catch (err) {
        reject(err);
      }
      // Timeout after 10 seconds
      setTimeout(() => {
        delete (window as any)[callbackId];
        reject(new Error('HealthKit timeout'));
      }, 10000);
    });
  }
}

// ── Android Health Connect Provider ──────────────────────────
export class HealthConnectProvider implements HealthDataProvider {
  name = 'Health Connect';

  isAvailable(): boolean {
    // Check if running in a Capacitor/Android WebView with Health Connect bridge
    return !!(window as any).HealthConnect;
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return await (window as any).HealthConnect.requestPermission([
        'Steps', 'HeartRate', 'SleepSession', 'Weight',
      ]);
    } catch {
      return false;
    }
  }

  async getSteps(date: string): Promise<HealthSteps | null> {
    if (!this.isAvailable()) return null;
    try {
      const result = await (window as any).HealthConnect.getSteps(date);
      if (result) return { date, count: result.count, source: 'Health Connect' };
    } catch {}
    return null;
  }

  async getSleep(date: string): Promise<HealthSleep | null> {
    if (!this.isAvailable()) return null;
    try {
      const result = await (window as any).HealthConnect.getSleep(date);
      if (result) return { ...result, date, source: 'Health Connect' };
    } catch {}
    return null;
  }

  async getHeartRate(date: string): Promise<HealthHeartRate | null> {
    if (!this.isAvailable()) return null;
    try {
      const result = await (window as any).HealthConnect.getHeartRate(date);
      if (result) return { date, time: result.time, bpm: result.bpm, source: 'Health Connect' };
    } catch {}
    return null;
  }

  async getWeight(date: string): Promise<HealthWeight | null> {
    if (!this.isAvailable()) return null;
    try {
      const result = await (window as any).HealthConnect.getWeight(date);
      if (result) return { date, weightKg: result.weightKg, source: 'Health Connect' };
    } catch {}
    return null;
  }
}

// ── Unified Health Manager ───────────────────────────────────
class HealthManager {
  private providers: HealthDataProvider[] = [];

  constructor() {
    this.providers = [
      new GoogleFitProvider(),
      new AppleHealthKitProvider(),
      new HealthConnectProvider(),
    ];
  }

  /**
   * Get all available providers on this device.
   */
  getAvailableProviders(): HealthDataProvider[] {
    return this.providers.filter(p => p.isAvailable());
  }

  /**
   * Get the first available provider.
   */
  getPrimaryProvider(): HealthDataProvider | null {
    return this.getAvailableProviders()[0] || null;
  }

  /**
   * Fetch steps from the best available source.
   */
  async getSteps(date: string): Promise<HealthSteps | null> {
    for (const provider of this.getAvailableProviders()) {
      const result = await provider.getSteps(date);
      if (result) return result;
    }
    return null;
  }

  /**
   * Fetch sleep from the best available source.
   */
  async getSleep(date: string): Promise<HealthSleep | null> {
    for (const provider of this.getAvailableProviders()) {
      const result = await provider.getSleep(date);
      if (result) return result;
    }
    return null;
  }

  /**
   * Fetch heart rate from the best available source.
   */
  async getHeartRate(date: string): Promise<HealthHeartRate | null> {
    for (const provider of this.getAvailableProviders()) {
      const result = await provider.getHeartRate(date);
      if (result) return result;
    }
    return null;
  }

  /**
   * Fetch weight from the best available source.
   */
  async getWeight(date: string): Promise<HealthWeight | null> {
    for (const provider of this.getAvailableProviders()) {
      const result = await provider.getWeight(date);
      if (result) return result;
    }
    return null;
  }

  /**
   * Sync all health data for a date and save to Dexie.
   */
  async syncHealthData(date: string): Promise<{
    steps?: HealthSteps;
    sleep?: HealthSleep;
    heartRate?: HealthHeartRate;
    weight?: HealthWeight;
  }> {
    const today = format(new Date(), 'yyyy-MM-dd');
    const targetDate = date || today;
    const result: any = {};

    const steps = await this.getSteps(targetDate);
    if (steps) {
      result.steps = steps;
      const existing = await db.stepLogs.where('date').equals(targetDate).first();
      if (!existing) {
        await db.stepLogs.add(withSyncMeta({
          date: targetDate,
          count: steps.count,
          source: steps.source,
        }));
      } else if (steps.count > existing.count) {
        await db.stepLogs.update(existing.id!, { count: steps.count, source: steps.source });
      }
    }

    const sleep = await this.getSleep(targetDate);
    if (sleep) {
      result.sleep = sleep;
      const existing = await db.sleepLogs.where('date').equals(targetDate).first();
      if (!existing) {
        await db.sleepLogs.add(withSyncMeta({
          date: targetDate,
          bedtime: sleep.bedtime,
          wakeTime: sleep.wakeTime,
          quality: sleep.quality,
          source: sleep.source,
        }));
      }
    }

    const heartRate = await this.getHeartRate(targetDate);
    if (heartRate) {
      result.heartRate = heartRate;
      await db.vitals.add(withSyncMeta({
        date: targetDate,
        time: heartRate.time,
        type: 'heart_rate',
        value1: heartRate.bpm,
        unit: 'bpm',
        source: heartRate.source,
      }));
    }

    const weight = await this.getWeight(targetDate);
    if (weight) {
      result.weight = weight;
      const existing = await db.bodyMetrics.where('date').equals(targetDate).first();
      if (!existing) {
        await db.bodyMetrics.add(withSyncMeta({
          date: targetDate,
          weightKg: weight.weightKg,
        }));
      }
    }

    return result;
  }
}

// Export singleton
export const healthManager = new HealthManager();
