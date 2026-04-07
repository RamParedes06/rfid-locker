'use client';

import { useEffect, useRef, useState } from 'react';
import DoorMatrix, { Door } from '@/components/DoorMatrix';
import RfidScanner from '@/components/RfidScanner';
import {
  Tag, ScanLine, Trash2, CheckCircle, AlertCircle, LayoutGrid,
  ChevronRight, ArrowLeft, MonitorSmartphone, Hash, Clock, X, Pencil,
} from 'lucide-react';

interface DoorEntry {
  doorId: string;
  doorNumber: number;
}

interface RfidRecord {
  id: string;
  rfid: string;
  doors: DoorEntry[];
  label?: string;
  createdAt: string;
}

type Step = 'select-doors' | 'scan-rfid';

export default function DashboardPage() {
  const [doors, setDoors] = useState<Door[]>([]);
  const [registrations, setRegistrations] = useState<RfidRecord[]>([]);
  const [selectedDoors, setSelectedDoors] = useState<Door[]>([]);
  const [step, setStep] = useState<Step>('select-doors');
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'register' | 'tags'>('register');
  const [editingRecord, setEditingRecord] = useState<RfidRecord | null>(null);
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

  function toggleDoor(door: Door) {
    setSelectedDoors((prev) => {
      const exists = prev.find((d) => d._id === door._id);
      if (exists) return prev.filter((d) => d._id !== door._id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, door];
    });
  }

  async function handleRfidScan(rfid: string) {
    if (selectedDoors.length === 0 || loading) return;
    setLoading(true);

    const res = await fetch('/api/rfid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rfid,
        doors: selectedDoors.map((d) => ({ doorId: d._id, doorNumber: d.number })),
        label: label.trim() || undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      showStatus('error', data.error ?? 'Registration failed');
    } else {
      const doorNums = selectedDoors.map((d) => `#${d.number}`).join(', ');
      showStatus('success', `RFID registered to door${selectedDoors.length > 1 ? 's' : ''} ${doorNums}`);
      setSelectedDoors([]);
      setLabel('');
      setStep('select-doors');
      fetchRegistrations();
      setActiveTab('tags');
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/rfid/${id}`, { method: 'DELETE' });
    fetchRegistrations();
  }

  async function handleEditSave(id: string, doors: DoorEntry[], label: string) {
    const res = await fetch(`/api/rfid/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doors, label: label.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      showStatus('error', data.error ?? 'Update failed');
    } else {
      showStatus('success', `Updated to door${doors.length > 1 ? 's' : ''} ${doors.map((d) => `#${d.doorNumber}`).join(', ')}`);
      setEditingRecord(null);
      fetchRegistrations();
    }
  }

  const registeredDoorIds = new Set(
    registrations
      .filter((r) => r.id !== editingRecord?.id)
      .flatMap((r) => r.doors.map((d) => d.doorId))
  );
  const availableDoors = doors.filter((d) => d.status === 'available' && !registeredDoorIds.has(d._id));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
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
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={<LayoutGrid className="w-4 h-4" />} label="Total Doors" value={doors.filter((d) => !d.isScreen).length} color="blue" />
          <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Available" value={availableDoors.length} color="emerald" />
          <StatCard icon={<Tag className="w-4 h-4" />} label="Registered Tags" value={registrations.length} color="violet" />
        </div>

        {status && (
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {status.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {status.message}
          </div>
        )}

        <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 w-fit">
          {(['register', 'tags'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab === 'register' ? 'Register Tag' : `Tags (${registrations.length})`}
            </button>
          ))}
        </div>

        {activeTab === 'register' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
            {step === 'select-doors' && (
              <>
                <div>
                  <h2 className="font-semibold text-base text-slate-800">Select doors (max 3)</h2>
                  <p className="text-slate-500 text-sm mt-0.5">
                    Pick 1–3 doors, then scan the RFID card to register.
                  </p>
                </div>

                {/* Selected doors chips */}
                {selectedDoors.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedDoors.map((d) => (
                      <span key={d._id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200">
                        <Hash className="w-3 h-3" />
                        Door {d.number}
                        <button onClick={() => toggleDoor(d)} className="hover:text-blue-900 ml-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {selectedDoors.length < 3 && (
                      <span className="text-xs text-slate-400 self-center">
                        {3 - selectedDoors.length} more allowed
                      </span>
                    )}
                  </div>
                )}

                <DoorMatrix
                  doors={doors}
                  selectedDoorIds={new Set(selectedDoors.map((d) => d._id))}
                  onSelect={toggleDoor}
                  registeredDoorIds={registeredDoorIds}
                  maxReached={selectedDoors.length >= 3}
                />

                {selectedDoors.length > 0 && (
                  <button
                    onClick={() => setStep('scan-rfid')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    <ScanLine className="w-4 h-4" />
                    Continue to scan RFID
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

            {step === 'scan-rfid' && (
              <div className="space-y-5">
                <button
                  onClick={() => setStep('select-doors')}
                  className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to door selection
                </button>

                <div className="flex flex-wrap gap-2 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="w-full text-sm font-semibold text-blue-900 mb-1">
                    Registering to {selectedDoors.length} door{selectedDoors.length > 1 ? 's' : ''}:
                  </p>
                  {selectedDoors.map((d) => (
                    <span key={d._id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200">
                      <Hash className="w-3 h-3" />
                      {d.number}
                      <span className="font-normal text-blue-500 capitalize ml-0.5">{d.size}</span>
                    </span>
                  ))}
                  <p className="w-full text-sm text-blue-600 mt-2 flex items-center gap-2">
                    {loading ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin inline-block" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <ScanLine className="w-4 h-4 animate-pulse" />
                        Tap the RFID card on the scanner now
                      </>
                    )}
                  </p>
                </div>

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

        {activeTab === 'tags' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {registrations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <Tag className="w-8 h-8 opacity-30" />
                <p className="text-sm">No RFID tags registered yet.</p>
                <button onClick={() => setActiveTab('register')} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors">
                  Register your first tag <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Doors</th>
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
                        <div className="flex flex-wrap gap-1">
                          {r.doors.map((d) => (
                            <span key={d.doorId} className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-xs">
                              <Hash className="w-3 h-3 text-slate-400" />
                              {d.doorNumber}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {r.label ?? <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono">{r.rfid}</code>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {new Date(r.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingRecord(r)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 transition-all"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {editingRecord && (
        <EditModal
          record={editingRecord}
          allDoors={doors}
          registeredDoorIds={registeredDoorIds}
          onSave={handleEditSave}
          onClose={() => setEditingRecord(null)}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'blue' | 'emerald' | 'violet' }) {
  const colors = {
    blue:    'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    violet:  'bg-violet-50 text-violet-600 border-violet-100',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function EditModal({
  record,
  allDoors,
  registeredDoorIds,
  onSave,
  onClose,
}: {
  record: RfidRecord;
  allDoors: Door[];
  registeredDoorIds: Set<string>;
  onSave: (id: string, doors: DoorEntry[], label: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedDoors, setSelectedDoors] = useState<DoorEntry[]>(record.doors);
  const [label, setLabel] = useState(record.label ?? '');
  const [saving, setSaving] = useState(false);

  function toggleDoor(door: Door) {
    setSelectedDoors((prev) => {
      const exists = prev.find((d) => d.doorId === door._id);
      if (exists) return prev.filter((d) => d.doorId !== door._id);
      if (prev.length >= 3) return prev;
      return [...prev, { doorId: door._id, doorNumber: door.number }];
    });
  }

  async function handleSave() {
    if (selectedDoors.length === 0) return;
    setSaving(true);
    await onSave(record.id, selectedDoors, label);
    setSaving(false);
  }

  const selectedDoorIds = new Set(selectedDoors.map((d) => d.doorId));
  const maxReached = selectedDoors.length >= 3;

  // Build Door objects for the matrix from selectedDoors
  const selectedDoorObjects = allDoors.filter((d) => selectedDoorIds.has(d._id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-800">Edit Tag</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{record.rfid}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {/* Label */}
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

          {/* Selected chips */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Doors <span className="text-slate-400 font-normal">(max 3)</span>
            </p>
            <div className="flex flex-wrap gap-2 min-h-[32px]">
              {selectedDoors.length === 0 && (
                <span className="text-xs text-slate-400 self-center">No doors selected</span>
              )}
              {selectedDoorObjects.map((d) => (
                <span key={d._id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200">
                  <Hash className="w-3 h-3" />
                  Door {d.number}
                  <button onClick={() => toggleDoor(d)} className="hover:text-blue-900 ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {!maxReached && selectedDoors.length > 0 && (
                <span className="text-xs text-slate-400 self-center">{3 - selectedDoors.length} more allowed</span>
              )}
            </div>
          </div>

          {/* Door matrix */}
          <DoorMatrix
            doors={allDoors}
            selectedDoorIds={selectedDoorIds}
            onSelect={toggleDoor}
            registeredDoorIds={registeredDoorIds}
            maxReached={maxReached}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedDoors.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
          >
            {saving ? (
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
