'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import RfidScanner from '@/components/RfidScanner';
import { DoorOpen, Wifi } from 'lucide-react';
import loadingAnim from '@/public/lottie-loading.json';
import successAnim from '@/public/lottie-success.json';
import errorAnim from '@/public/lottie-error.json';
import scanAnim from '@/public/lottie-scan.json';
import doorAnim from '@/public/lottie-door.json';
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

type ScanState = 'idle' | 'loading' | 'pick-door' | 'opening' | 'success' | 'error';

interface DoorEntry {
  doorId: string;
  doorNumber: number;
}

interface ScanResult {
  id?: string;
  label?: string;
  doors?: DoorEntry[];
  openedDoor?: number;
  message?: string;
}

const BG: Record<ScanState, string> = {
  idle:        'from-slate-900 via-blue-950 to-slate-900',
  loading:     'from-slate-900 via-indigo-950 to-slate-900',
  'pick-door': 'from-slate-900 via-blue-950 to-slate-900',
  opening:     'from-slate-900 via-indigo-950 to-slate-900',
  success:     'from-slate-900 via-emerald-950 to-slate-900',
  error:       'from-slate-900 via-red-950 to-slate-900',
};

export default function ScanPage() {
  const [state, setState] = useState<ScanState>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);

  function resetAfter(ms = 4000) {
    setTimeout(() => {
      setState('idle');
      setResult(null);
    }, ms);
  }

  async function handleScan(rfid: string) {
    if (state !== 'idle') return;
    setState('loading');
    setResult(null);

    const res = await fetch('/api/rfid/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rfid }),
    });

    const data = await res.json();

    if (!res.ok) {
      setState('error');
      setResult({ message: data.error ?? 'Unknown error' });
      resetAfter(4000);
      return;
    }

    if (data.doors.length === 1) {
      await openDoor(data.doors[0].doorNumber, data.label);
      return;
    }

    setState('pick-door');
    setResult({ id: data.id, label: data.label, doors: data.doors });
  }

  async function openDoor(doorNumber: number, label?: string) {
    setState('opening');

    const res = await fetch('/api/rfid/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doorNumber }),
    });

    const data = await res.json();

    if (res.ok) {
      setState('success');
      setResult((prev) => ({ ...prev, openedDoor: doorNumber, label: prev?.label ?? label }));
    } else {
      setState('error');
      setResult({ message: data.error ?? 'Failed to open door' });
    }

    resetAfter(4000);
  }

  const isFullscreen = state === 'pick-door';

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center bg-gradient-to-br ${BG[state]} text-white transition-all duration-700 p-8`}
    >
      <a
        href="/dashboard"
        className="absolute top-5 left-5 text-xs text-slate-500 hover:text-slate-300 transition-colors z-10"
      >
        ← Dashboard
      </a>

      {/* ── Single-state card (idle / loading / opening / success / error) ── */}
      {!isFullscreen && (
        <div
          className={`relative w-full max-w-xs rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 ring-4 shadow-2xl flex flex-col items-center gap-6 px-8 py-10 transition-all duration-500 ${
            state === 'idle'    ? 'ring-blue-500/30 shadow-blue-500/20' :
            state === 'loading' || state === 'opening' ? 'ring-indigo-400/30 shadow-indigo-500/20' :
            state === 'success' ? 'ring-emerald-400/30 shadow-emerald-500/20' :
            'ring-red-400/30 shadow-red-500/20'
          }`}
        >
          {state === 'idle' && (
            <>
              <NfcPulse />
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Tap your card</h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Hold your RFID card near the scanner to open your locker
                </p>
              </div>
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
              </span>
            </>
          )}

          {(state === 'loading' || state === 'opening') && (
            <>
              <div className="w-40 h-40">
                <Lottie animationData={loadingAnim as any} loop autoplay style={{ width: '100%', height: '100%' }} />
              </div>
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-indigo-300">
                  {state === 'loading' ? 'Verifying...' : 'Opening...'}
                </h1>
                <p className="text-slate-400 text-sm">Please wait a moment</p>
              </div>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="w-40 h-40">
                <Lottie animationData={successAnim as any} loop={false} autoplay style={{ width: '100%', height: '100%' }} />
              </div>
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-emerald-300">Door Opened</h1>
                <p className="text-6xl font-black tracking-tighter mt-1">#{result?.openedDoor}</p>
                {result?.label && <p className="text-slate-400 text-sm">{result.label}</p>}
                <div className="flex items-center justify-center gap-2 text-emerald-400 pt-1">
                  <DoorOpen className="w-4 h-4" />
                  <span className="text-xs">Please retrieve your items</span>
                </div>
              </div>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="w-40 h-40">
                <Lottie animationData={errorAnim as any} loop={false} autoplay style={{ width: '100%', height: '100%' }} />
              </div>
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-red-300">Access Denied</h1>
                <p className="text-slate-400 text-sm">
                  {result?.message ?? 'RFID card not recognized'}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Multi-door picker — Lottie cards ── */}
      {isFullscreen && result?.doors && (
        <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Select your door</h1>
            {result.label
              ? <p className="text-slate-400 text-2xl">{result.label}</p>
              : <p className="text-slate-500 text-sm">Tap a door card to open it</p>
            }
          </div>

          <div
            className={`w-full grid gap-5 ${
              result.doors.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
            }`}
          >
            {result.doors.map((door) => (
              <DoorCard
                key={door.doorId}
                doorNumber={door.doorNumber}
                onTap={() => openDoor(door.doorNumber, result.label)}
              />
            ))}
          </div>
        </div>
      )}

      <p className="absolute bottom-5 text-xs text-slate-600 tracking-widest uppercase">
        Locker Kiosk
      </p>

      <RfidScanner onScan={handleScan} disabled={state !== 'idle'} />
    </div>
  );
}

/* ── Door card with Lottie animations ── */
function DoorCard({ doorNumber, onTap }: { doorNumber: number; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className="relative flex flex-col items-center gap-4 rounded-3xl bg-white/5 active:bg-white/15 border border-white/10 active:border-blue-400/60 backdrop-blur-md px-6 py-8 transition-all duration-150 active:scale-[0.97] shadow-lg shadow-blue-900/20"
    >
      {/* Door lottie — always looping */}
      <div className="w-28 h-28">
        <Lottie
          animationData={doorAnim as any}
          loop
          autoplay
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Door number */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-slate-400 uppercase tracking-widest">Door</span>
        <span className="text-5xl font-black tracking-tighter text-white leading-none">
          {doorNumber}
        </span>
      </div>

      {/* Tap hint — always visible */}
      <div className="flex items-center gap-1.5 text-xs text-blue-300">
        <DoorOpen className="w-3.5 h-3.5" />
        <span>Tap to open</span>
      </div>
    </button>
  );
}

/* ── Idle NFC pulse ── */
function NfcPulse() {
  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute rounded-full border-2 border-blue-400/50 animate-ping"
          style={{
            width: `${48 + i * 28}px`,
            height: `${48 + i * 28}px`,
            animationDelay: `${i * 0.4}s`,
            animationDuration: '2s',
          }}
        />
      ))}
      <div className="relative z-10 w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
        <Wifi className="w-7 h-7 text-blue-400" />
      </div>
    </div>
  );
}
