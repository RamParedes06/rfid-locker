'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import RfidScanner from '@/components/RfidScanner';
import { DoorOpen, Wifi } from 'lucide-react';
import loadingAnim from '@/public/lottie-loading.json';
import successAnim from '@/public/lottie-success.json';
import errorAnim from '@/public/lottie-error.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

type ScanState = 'idle' | 'loading' | 'success' | 'error';

interface ScanResult {
  door?: number;
  label?: string;
  message?: string;
}

const BG: Record<ScanState, string> = {
  idle:    'from-slate-900 via-blue-950 to-slate-900',
  loading: 'from-slate-900 via-indigo-950 to-slate-900',
  success: 'from-slate-900 via-emerald-950 to-slate-900',
  error:   'from-slate-900 via-red-950 to-slate-900',
};

const RING: Record<ScanState, string> = {
  idle:    'ring-blue-500/30 shadow-blue-500/20',
  loading: 'ring-indigo-400/30 shadow-indigo-500/20',
  success: 'ring-emerald-400/30 shadow-emerald-500/20',
  error:   'ring-red-400/30 shadow-red-500/20',
};

export default function ScanPage() {
  const [state, setState] = useState<ScanState>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);

  async function handleScan(rfid: string) {
    if (state === 'loading') return;
    setState('loading');
    setResult(null);

    const res = await fetch('/api/rfid/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rfid }),
    });

    const data = await res.json();

    if (res.ok) {
      setState('success');
      setResult({ door: data.door, label: data.label });
    } else {
      setState('error');
      setResult({ message: data.error ?? 'Unknown error' });
    }

    setTimeout(() => {
      setState('idle');
      setResult(null);
    }, 4000);
  }

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center bg-gradient-to-br ${BG[state]} text-white transition-all duration-700 p-8`}
    >
      <a
        href="/dashboard"
        className="absolute top-5 left-5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        ← Dashboard
      </a>

      <div
        className={`relative w-full max-w-xs rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 ring-4 ${RING[state]} shadow-2xl flex flex-col items-center gap-6 px-8 py-10 transition-all duration-500`}
      >
        {/* Idle — CSS NFC pulse (no Lottie) */}
        {state === 'idle' && <NfcPulse />}

        {/* Loading — Lottie spinner */}
        {state === 'loading' && (
          <div className="w-40 h-40">
            <Lottie
              key="loading"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              animationData={loadingAnim as any}
              loop
              autoplay
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        )}

        {/* Success — Lottie checkmark */}
        {state === 'success' && (
          <div className="w-40 h-40">
            <Lottie
              key="success"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              animationData={successAnim as any}
              loop={false}
              autoplay
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        )}

        {/* Error — Lottie X */}
        {state === 'error' && (
          <div className="w-40 h-40">
            <Lottie
              key="error"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              animationData={errorAnim as any}
              loop={false}
              autoplay
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        )}

        {/* Text */}
        <div className="text-center space-y-2">
          {state === 'idle' && (
            <>
              <h1 className="text-2xl font-bold tracking-tight">Tap your card</h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Hold your RFID card near the scanner to open your locker
              </p>
            </>
          )}
          {state === 'loading' && (
            <>
              <h1 className="text-2xl font-bold text-indigo-300">Verifying...</h1>
              <p className="text-slate-400 text-sm">Please wait a moment</p>
            </>
          )}
          {state === 'success' && result && (
            <>
              <h1 className="text-2xl font-bold text-emerald-300">Door Opened</h1>
              <p className="text-6xl font-black tracking-tighter mt-1">#{result.door}</p>
              {result.label && <p className="text-slate-400 text-sm">{result.label}</p>}
              <div className="flex items-center justify-center gap-2 text-emerald-400 pt-1">
                <DoorOpen className="w-4 h-4" />
                <span className="text-xs">Please retrieve your items</span>
              </div>
            </>
          )}
          {state === 'error' && (
            <>
              <h1 className="text-2xl font-bold text-red-300">Access Denied</h1>
              <p className="text-slate-400 text-sm">
                {result?.message ?? 'RFID card not recognized'}
              </p>
            </>
          )}
        </div>

        {/* Idle pulse dot */}
        {state === 'idle' && (
          <span className="flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
        )}
      </div>

      <p className="absolute bottom-5 text-xs text-slate-600 tracking-widest uppercase">
        Locker Kiosk
      </p>

      <RfidScanner onScan={handleScan} disabled={state === 'loading'} />
    </div>
  );
}

/** Animated NFC / tap-card icon built with pure CSS */
function NfcPulse() {
  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      {/* Expanding rings */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute rounded-full border-2 border-blue-400/50 animate-ping"
          style={{
            width:  `${48 + i * 28}px`,
            height: `${48 + i * 28}px`,
            animationDelay: `${i * 0.4}s`,
            animationDuration: '2s',
          }}
        />
      ))}
      {/* Center icon */}
      <div className="relative z-10 w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
        <Wifi className="w-7 h-7 text-blue-400" />
      </div>
    </div>
  );
}
