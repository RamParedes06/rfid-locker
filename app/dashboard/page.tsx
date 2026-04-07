'use client';

import { useEffect, useRef, useState } from 'react';
import DoorMatrix, { Door } from '@/components/DoorMatrix';
import RfidScanner from '@/components/RfidScanner';
import {
  Tag,
  ScanLine,
  Trash2,
  CheckCircle,
  AlertCircle,
  LayoutGrid,
  ChevronRight,
  ArrowLeft,
  MonitorSmartphone,
  Hash,
  Clock,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'register' | 'tags'>('register');
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchDoors();
    fetchRegistrations();
  }, []);

  async function fetchDoors() {
    const res = await fetch('/api/doors');
    const data = await res.json();
    const units: Door[][] = Array.isArray(data) ? data : data?.units ?? [];
    const allDoors: Door[] = (units as unknown as { columns?: { doors?: Door[] }[] }[]).flatMap((unit) =>
      (unit.columns ?? []).flatMap((col) => col.doors ?? [])
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
      setActiveTab('tags');
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/rfid/${id}`, { method: 'DELETE' });
    fetchRegistrations();
  }

  const registeredDoorIds = new Set(registrations.map((r) => r.doorId));
  const availableDoors = doors.filter((d) => d.status === 'available' && !registeredDoorIds.has(d._id));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top nav */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Tag className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-slate-800">RFID Locker Admin</span>
          </div>
          <a
            href="/scan"
            className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <MonitorSmartphone className="w-3.5 h-3.5" />
            Kiosk View
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 w-full space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={<LayoutGrid className="w-4 h-4" />}
            label="Total Doors"
            value={doors.filter((d) => !d.isScreen).length}
            color="blue"
          />
          <StatCard
            icon={<CheckCircle className="w-4 h-4" />}
            label="Available"
            value={availableDoors.length}
            color="emerald"
          />
          <StatCard
            icon={<Tag className="w-4 h-4" />}
            label="Registered Tags"
            value={registrations.length}
            color="violet"
          />
        </div>

        {/* Toast */}
        {status && (
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border ${
              status.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }`}
          >
            {status.type === 'success'
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            {status.message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 w-fit">
          {(['register', 'tags'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'register' ? 'Register Tag' : `Tags (${registrations.length})`}
            </button>
          ))}
        </div>

        {/* Register tab */}
        {activeTab === 'register' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
            {step === 'select-door' && (
              <>
                <div>
                  <h2 className="font-semibold text-base text-slate-800">Select a door</h2>
                  <p className="text-slate-500 text-sm mt-0.5">
                    Pick an available door from the matrix, then scan the RFID card.
                  </p>
                </div>
                <DoorMatrix
                  doors={doors}
                  selectedDoorId={selectedDoor?._id}
                  onSelect={(door) => {
                    setSelectedDoor(door);
                    setStep('scan-rfid');
                  }}
                  registeredDoorIds={registeredDoorIds}
                />
              </>
            )}

            {step === 'scan-rfid' && selectedDoor && (
              <div className="space-y-5">
                <button
                  onClick={() => { setStep('select-door'); setSelectedDoor(null); }}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to door selection
                </button>

                {/* Selected door banner */}
                <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
                    <Hash className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-blue-900">
                      Door #{selectedDoor.number}
                      <span className="ml-2 text-xs font-normal text-blue-500 capitalize">
                        {selectedDoor.size}
                      </span>
                    </p>
                    <p className="text-sm text-blue-600 mt-0.5">
                      {loading ? 'Registering...' : 'Tap the RFID card on the scanner now'}
                    </p>
                  </div>
                  {!loading && (
                    <ScanLine className="w-6 h-6 text-blue-500 animate-pulse shrink-0" />
                  )}
                  {loading && (
                    <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
                  )}
                </div>

                {/* Label input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Label <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. John's card"
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>

                <RfidScanner onScan={handleRfidScan} disabled={loading} />
              </div>
            )}
          </div>
        )}

        {/* Tags tab */}
        {activeTab === 'tags' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {registrations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <Tag className="w-8 h-8 opacity-30" />
                <p className="text-sm">No RFID tags registered yet.</p>
                <button
                  onClick={() => setActiveTab('register')}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                >
                  Register your first tag <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Door</th>
                    <th className="text-left px-5 py-3 font-medium">Label</th>
                    <th className="text-left px-5 py-3 font-medium">RFID</th>
                    <th className="text-left px-5 py-3 font-medium">Registered</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registrations.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                          <Hash className="w-3.5 h-3.5 text-slate-400" />
                          {r.doorNumber}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {r.label ?? <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono">
                          {r.rfid}
                        </code>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {new Date(r.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'emerald' | 'violet';
}) {
  const colors = {
    blue:    'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    violet:  'bg-violet-50 text-violet-600 border-violet-100',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
