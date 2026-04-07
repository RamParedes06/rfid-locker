'use client';

import { useState } from 'react';
import RfidScanner from '@/components/RfidScanner';
import { ScanLine, CheckCircle, XCircle, DoorOpen } from 'lucide-react';

type ScanState = 'idle' | 'loading' | 'success' | 'error';

interface ScanResult {
  door?: number;
  label?: string;
  message?: string;
}

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

    // Reset to idle after 4 seconds
    setTimeout(() => {
      setState('idle');
      setResult(null);
    }, 4000);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-8">
      <a
        href="/dashboard"
        className="absolute top-4 left-4 text-xs text-gray-500 hover:text-gray-300"
      >
        ← Dashboard
      </a>

      <div className="w-full max-w-sm text-center space-y-8">
        {/* Idle state */}
        {state === 'idle' && (
          <>
            <ScanLine className="w-24 h-24 mx-auto text-blue-400 animate-pulse" />
            <div>
              <h1 className="text-3xl font-bold">Tap your RFID card</h1>
              <p className="text-gray-400 mt-2 text-sm">Hold your card near the scanner to open your locker</p>
            </div>
          </>
        )}

        {/* Loading */}
        {state === 'loading' && (
          <>
            <div className="w-24 h-24 mx-auto rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
            <p className="text-xl font-semibold text-blue-300">Opening door...</p>
          </>
        )}

        {/* Success */}
        {state === 'success' && result && (
          <>
            <CheckCircle className="w-24 h-24 mx-auto text-green-400" />
            <div>
              <h2 className="text-3xl font-bold text-green-300">Door Opened</h2>
              <p className="text-5xl font-black mt-3">#{result.door}</p>
              {result.label && (
                <p className="text-gray-400 mt-2 text-sm">{result.label}</p>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 text-green-400">
              <DoorOpen className="w-5 h-5" />
              <span className="text-sm">Please retrieve your items</span>
            </div>
          </>
        )}

        {/* Error */}
        {state === 'error' && (
          <>
            <XCircle className="w-24 h-24 mx-auto text-red-400" />
            <div>
              <h2 className="text-3xl font-bold text-red-300">Access Denied</h2>
              <p className="text-gray-400 mt-2 text-sm">{result?.message ?? 'RFID not recognized'}</p>
            </div>
          </>
        )}
      </div>

      {/* Always-on RFID scanner listener */}
      <RfidScanner onScan={handleScan} disabled={state === 'loading'} />
    </div>
  );
}
