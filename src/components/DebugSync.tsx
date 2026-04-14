import React, { useState, useEffect } from 'react';
import { useAppStore } from '../lib/store';
import { RefreshCw, CheckCircle2, XCircle, Activity, ShieldCheck, Database } from 'lucide-react';
import axios from 'axios';

export default function DebugSync() {
  const { googleFitTokens, isGoogleFitConnected } = useAppStore();
  const [status, setStatus] = useState<any>({
    token: 'Checking...',
    api: 'Waiting...',
    data: [],
    logs: []
  });
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string) => {
    setStatus((prev: any) => ({ ...prev, logs: [msg, ...prev.logs].slice(0, 10) }));
  };

  const checkEverything = async () => {
    setLoading(true);
    addLog('Starting automated diagnostics...');
    
    // 1. Check Tokens
    if (!googleFitTokens) {
      setStatus((prev: any) => ({ ...prev, token: 'Missing (ยังไม่เชื่อมต่อ)' }));
      addLog('Error: No tokens found in storage.');
    } else if (!googleFitTokens.access_token) {
      setStatus((prev: any) => ({ ...prev, token: 'Invalid (รูปแบบกุญแจผิด)' }));
      addLog('Error: Access token is missing from the token object.');
    } else {
      setStatus((prev: any) => ({ ...prev, token: 'Found (กุญแจพร้อมใช้งาน)' }));
      addLog('Success: Tokens are present.');
    }

    // 2. Test Google Fit API
    if (googleFitTokens?.access_token) {
      try {
        addLog('Testing connection to Google Fit API...');
        const res = await axios.get('https://www.googleapis.com/fitness/v1/users/me/dataSources', {
          headers: { Authorization: `Bearer ${googleFitTokens.access_token}` }
        });
        setStatus((prev: any) => ({ ...prev, api: 'Connected (เชื่อมต่อกูเกิลได้ปกติ)' }));
        addLog(`Success: Found ${res.data.dataSource?.length || 0} data sources.`);
        
        // 3. Try sample fetch
        addLog('Attempting to fetch 24h step data...');
        const now = Date.now();
        const yesterday = now - (24 * 60 * 60 * 1000);
        const stepsRes = await axios.post(
          'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
          {
            aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
            bucketByTime: { durationMillis: 86400000 },
            startTimeMillis: yesterday,
            endTimeMillis: now,
          },
          { headers: { Authorization: `Bearer ${googleFitTokens.access_token}` } }
        );
        const count = stepsRes.data.bucket[0]?.dataset[0]?.point[0]?.value[0]?.intVal || 0;
        addLog(`Data Check: Last 24h steps from Google Fit = ${count}`);
        
      } catch (err: any) {
        const errorMsg = err.response?.data?.error?.message || err.message;
        setStatus((prev: any) => ({ ...prev, api: `Failed: ${errorMsg}` }));
        addLog(`Error syncing: ${errorMsg}`);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    checkEverything();
  }, []);

  return (
    <div className="p-6 max-w-md mx-auto min-h-screen bg-zinc-950 text-white font-sans">
      <div className="flex items-center gap-2 mb-8 mt-4">
        <Activity className="text-green-500 w-8 h-8" />
        <h1 className="text-2xl font-black italic tracking-tighter">DIAGNOSTICS</h1>
      </div>

      <div className="space-y-4">
        {/* Status Cards */}
        <StatusCard 
          icon={<ShieldCheck className="w-5 h-5" />}
          title="สถานะกุญแจ (Token)"
          value={status.token}
          success={status.token.includes('Found')}
        />
        <StatusCard 
          icon={<Activity className="w-5 h-5" />}
          title="การเชื่อมต่อ API"
          value={status.api}
          success={status.api.includes('Connected')}
        />

        {/* Action Button */}
        <button 
          onClick={checkEverything}
          disabled={loading}
          className="w-full py-4 bg-green-500 hover:bg-green-400 disabled:bg-zinc-800 text-black font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {loading ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
          ตรวจสุขภาพการเชื่อมต่ออีกครั้ง
        </button>

        {/* Live Logs */}
        <div className="mt-8 bg-black/40 border border-white/5 rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-4 text-zinc-400">
            <Database className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Live Sync Logs</span>
          </div>
          <div className="space-y-2">
            {status.logs.map((log: string, i: number) => (
              <p key={i} className={`text-xs font-mono break-words ${log.includes('Error') ? 'text-red-400' : log.includes('Success') ? 'text-green-400' : 'text-zinc-500'}`}>
                {`> ${log}`}
              </p>
            ))}
          </div>
        </div>

        <div className="text-center p-4">
          <p className="text-xs text-zinc-600 leading-relaxed">
            * คัดลอกข้อความใน Live Sync Logs มาให้ผม หรือถ่ายรูปหน้านี้ส่งมาได้เลยครับ ผมจะรู้ทันทีว่าติดขัดที่ตรงไหน
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon, title, value, success }: any) {
  return (
    <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-[2rem] p-5 flex items-start gap-4">
      <div className={`p-3 rounded-2xl ${success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
        {success ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
      </div>
      <div>
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">{title}</p>
        <p className={`text-sm font-semibold ${success ? 'text-white' : 'text-red-400'}`}>{value}</p>
      </div>
    </div>
  );
}
