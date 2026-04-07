'use client';

import { useEffect, useRef, useState } from 'react';
import DoorMatrix, { Door } from '@/components/DoorMatrix';
import RfidScanner from '@/components/RfidScanner';
import { Trash2, Tag, ScanLine, CheckCircle, AlertCircle } from 'lucide-react';

interface RfidRecord {
  id: string;
  rfid: string;
  doorId: string;
  doorNumber: number;
  label?: string;
  createdAt: string;
}

type Step = 'select-door' | 'scan-rfid';

export default function DashboardPage() {
  const [doors, setDoors] = useState<Door[]>([]);
  const [registrations, setRegistrations] = useState<RfidRecord[]>([]);
  const [selectedDoor, setSelectedDoor] = useState<Door | null>(null);
  const [step, setStep] = useState<Step>('select-door');
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchDoors();
    fetchRegistrations();
  }, []);

  async function fetchDoors() {
    const res = await fetch('/api/doors');
    const data = await res.json();
    // locker -> units[] -> columns[] -> doors[]
    const units: any[] = Array.isArray(data) ? data : data?.units ?? [];
    const allDoors: Door[] = units.flatMap((unit: any) =>
      (unit.columns ?? []).flatMap((col: any) => col.doors ?? [])
    );
    setDoors(allDoors);
  }

  async function fetchRegistrations() {
    const res = await fetch('/api/rfid');
    setRegistrations(await res.json());
  }

  function showStatus(type: 'success' | 'error', message: string) {
    setStatus({ type, message });
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 4000);
  }

  async function handleRfidScan(rfid: string) {
    if (!selectedDoor || loading) return;
    setLoading(true);

    const res = await fetch('/api/rfid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rfid,
        doorId: selectedDoor._id,
        doorNumber: selectedDoor.number,
        label: label.trim() || undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      showStatus('error', data.error ?? 'Registration failed');
    } else {
      showStatus('success', `RFID registered to door #${selectedDoor.number}`);
      setSelectedDoor(null);
      setLabel('');
      setStep('select-door');
      fetchRegistrations();
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/rfid/${id}`, { method: 'DELETE' });
    fetchRegistrations();
  }

  const registeredDoorIds = new Set(registrations.map((r) => r.doorId));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tag className="w-6 h-6 text-blue-600" />
          RFID Locker Dashboard
        </h1>
        <a
          href="/scan"
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Kiosk View →
        </a>
      </div>

      {status && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
            status.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {status.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {status.message}
        </div>
      )}

      {/* Registration flow */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-lg">Register RFID Tag</h2>

        {step === 'select-door' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Select an available door from the matrix below, then tap your RFID card.
            </p>
            <DoorMatrix
              doors={doors}
              selectedDoorId={selectedDoor?._id}
              onSelect={(door) => {
                setSelectedDoor(door);
                setStep('scan-rfid');
              }}
              registeredDoorIds={registeredDoorIds}
            />
          </div>
        )}

        {step === 'scan-rfid' && selectedDoor && (
          <div className="space-y-4">
            <button
              onClick={() => { setStep('select-door'); setSelectedDoor(null); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to door selection
            </button>

            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <ScanLine className="w-8 h-8 text-blue-500 shrink-0" />
              <div>
                <p className="font-semibold text-blue-800">
                  Door #{selectedDoor.number} selected ({selectedDoor.size})
                </p>
                <p className="text-sm text-blue-600">
                  {loading ? 'Registering...' : 'Tap your RFID card on the scanner now'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Label (optional)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. John's card"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Hidden RFID scanner input — always listening */}
            <RfidScanner onScan={handleRfidScan} disabled={loading} />
          </div>
        )}
      </div>

      {/* Registrations list */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h2 className="font-semibold text-lg">Registered RFID Tags ({registrations.length})</h2>

        {registrations.length === 0 ? (
          <p className="text-sm text-gray-400">No registrations yet.</p>
        ) : (
          <div className="divide-y">
            {registrations.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-sm">
                    Door #{r.doorNumber}
                    {r.label && <span className="ml-2 text-gray-500">— {r.label}</span>}
                  </p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{r.rfid}</p>
                  <p className="text-xs text-gray-300 mt-0.5">
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-red-400 hover:text-red-600 p-1 rounded transition"
                  title="Remove registration"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
