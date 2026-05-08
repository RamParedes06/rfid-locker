'use client';

import { useEffect, useRef, useState } from 'react';
import DoorMatrix, { Door } from '@/components/DoorMatrix';
import RfidScanner from '@/components/RfidScanner';
import {
  Tag, ScanLine, Trash2, CheckCircle, AlertCircle, LayoutGrid,
  ChevronRight, MonitorSmartphone, Hash, Clock, X, Pencil, ArrowRight, User,
  DoorOpen, DoorClosed,
} from 'lucide-react';

const VERSION = process.env.NEXT_PUBLIC_VERSION_CONTROL ?? 'Multi';

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

interface RfidTransaction {
  id: string;
  rfid: string;
  doorId: string;
  doorNumber: number;
  openedAt: string;
}

interface AccessLog {
  id: string;
  rfid: string;
  label?: string;
  doorNumber: number;
  action: 'checkin' | 'checkout';
  timestamp: string;
}

type ModalStep = 'scan' | 'label';

export default function DashboardPage() {
  const [doors, setDoors] = useState<Door[]>([]);
  const [registrations, setRegistrations] = useState<RfidRecord[]>([]);
  const [transactions, setTransactions] = useState<RfidTransaction[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [selectedDoors, setSelectedDoors] = useState<Door[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('scan');
  const [scannedRfid, setScannedRfid] = useState('');
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'register' | 'tags' | 'logs'>('register');
  const [editingRecord, setEditingRecord] = useState<RfidRecord | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDoors();
    fetchRegistrations();
    fetchTransactions();
    fetchLogs();
    const interval = setInterval(() => {
      fetchTransactions();
      fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchTransactions() {
    const res = await fetch('/api/transactions');
    if (res.ok) setTransactions(await res.json());
  }

  async function fetchLogs() {
    const res = await fetch('/api/logs');
    if (res.ok) setLogs(await res.json());
  }

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
      if (prev.length >= 3) return prev;
      return [...prev, door];
    });
  }

  function openModal() {
    setModalStep('scan');
    setScannedRfid('');
    setLabel('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setScannedRfid('');
    setLabel('');
    setModalStep('scan');
  }

  function handleRfidScan(rfid: string) {
    if (!modalOpen || modalStep !== 'scan') return;
    setScannedRfid(rfid);
    setModalStep('label');
    // auto-focus label input after state update
    setTimeout(() => labelInputRef.current?.focus(), 50);
  }

  async function handleRegister() {
    if (!scannedRfid || loading) return;
    setLoading(true);

    const body = VERSION === 'Single'
      ? { rfid: scannedRfid, label: label.trim() || undefined }
      : {
          rfid: scannedRfid,
          doors: selectedDoors.map((d) => ({ doorId: d._id, doorNumber: d.number })),
          label: label.trim() || undefined,
        };

    const res = await fetch('/api/rfid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      showStatus('error', data.error ?? 'Registration failed');
    } else {
      if (VERSION === 'Single') {
        showStatus('success', `Tag registered${label.trim() ? ` for ${label.trim()}` : ''}`);
      } else {
        const doorNums = selectedDoors.map((d) => `#${d.number}`).join(', ');
        showStatus('success', `RFID registered to door${selectedDoors.length > 1 ? 's' : ''} ${doorNums}`);
        setSelectedDoors([]);
      }
      closeModal();
      fetchRegistrations();
      setActiveTab('tags');
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/rfid/${id}`, { method: 'DELETE' });
    fetchRegistrations();
  }

  async function handleEditSave(id: string, doors: DoorEntry[], label: string, rfid: string): Promise<string | null> {
    const res = await fetch(`/api/rfid/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doors, label: label.trim() || undefined, rfid }),
    });
    const data = await res.json();
    if (!res.ok) {
      return data.error ?? 'Update failed';
    }
    showStatus('success', `Updated to door${doors.length > 1 ? 's' : ''} ${doors.map((d) => `#${d.doorNumber}`).join(', ')}`);
    setEditingRecord(null);
    fetchRegistrations();
    return null;
  }

  const registeredDoorIds = new Set(
    registrations
      .filter((r) => r.id !== editingRecord?.id)
      .flatMap((r) => r.doors.map((d) => d.doorId))
  );
  const availableDoors = doors.filter((d) => d.status === 'available' && !registeredDoorIds.has(d._id));

  return (
    <div className="min-h-screen bg-gradient text-slate-800 flex flex-col">
      {/* Header */}
      <header className="border-b border-teal-100 sticky top-0 z-10 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shadow-md shadow-teal-500/30">
              <Tag className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-slate-800">RFID Locker Admin</span>
          </div>
          <a
            href="/scan"
            className="flex items-center gap-1.5 text-xs gradient-primary hover:opacity-90 text-white px-3 py-1.5 rounded-lg transition-opacity shadow-md shadow-teal-500/20"
          >
            <MonitorSmartphone className="w-3.5 h-3.5" />
            Kiosk View
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 w-full space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={<LayoutGrid className="w-4 h-4" />} label="Total Doors"     value={doors.filter((d) => !d.isScreen).length} color="teal" />
          <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Available"       value={availableDoors.length}                   color="green" />
          <StatCard icon={<Tag className="w-4 h-4" />}         label="Registered Tags" value={registrations.length}                    color="cyan" />
        </div>

        {/* Status banner */}
        {status && (
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border ${
            status.type === 'success'
              ? 'bg-teal-50 text-teal-700 border-teal-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>
            {status.type === 'success'
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            {status.message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white/60 border border-teal-100 rounded-xl p-1 w-fit shadow-sm">
          {(['register', 'tags', 'logs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'gradient-primary text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'register' ? 'Register Tag' : tab === 'tags' ? `Tags (${registrations.length})` : `Logs (${logs.length})`}
            </button>
          ))}
        </div>

        {/* Register tab */}
        {activeTab === 'register' && VERSION === 'Multi' && (
          <div className="bg-white border border-teal-100 rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-base text-slate-800">Select doors (max 3)</h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  Pick 1–3 doors, then click Continue to scan the RFID card.
                </p>
              </div>
              {selectedDoors.length > 0 && (
                <button
                  onClick={openModal}
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 gradient-primary hover:opacity-90 text-white text-sm font-medium rounded-xl transition-opacity shadow-md shadow-teal-500/20"
                >
                  <ScanLine className="w-4 h-4" />
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Selected door chips */}
            {selectedDoors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedDoors.map((d) => (
                  <span key={d._id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold border border-teal-200">
                    <Hash className="w-3 h-3" />
                    Door {d.number}
                    <button onClick={() => toggleDoor(d)} className="hover:text-teal-900 ml-0.5">
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
          </div>
        )}

        {/* Single mode — read-only door overview + register button */}
        {activeTab === 'register' && VERSION === 'Single' && (
          <div className="bg-white border border-teal-100 rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-base text-slate-800">Door overview</h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  Doors are assigned automatically in order when a registered tag is tapped.
                </p>
              </div>
              <button
                onClick={openModal}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 gradient-primary hover:opacity-90 text-white text-sm font-medium rounded-xl transition-opacity shadow-md shadow-teal-500/20"
              >
                <User className="w-4 h-4" />
                Register Tag
              </button>
            </div>

            {/* Read-only door matrix — no onSelect, no selection state */}
            <DoorMatrix
              doors={doors}
              selectedDoorIds={new Set()}
              onSelect={() => {}}
              registeredDoorIds={registeredDoorIds}
              maxReached={true}
              readOnly
            />
          </div>
        )}

        {/* Tags tab */}
        {activeTab === 'tags' && (
          <div className="bg-white border border-teal-100 rounded-2xl overflow-hidden shadow-sm">
            {registrations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <Tag className="w-8 h-8 opacity-30" />
                <p className="text-sm">No RFID tags registered yet.</p>
                <button onClick={() => setActiveTab('register')} className="flex items-center gap-1 text-xs text-teal-500 hover:text-teal-700 transition-colors">
                  Register your first tag <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    {VERSION !== 'Single' && <th className="text-left px-5 py-3 font-medium">Doors</th>}
                    {VERSION === 'Single'  && <th className="text-left px-5 py-3 font-medium">Door</th>}
                    <th className="text-left px-5 py-3 font-medium">Name</th>
                    <th className="text-left px-5 py-3 font-medium">RFID</th>
                    <th className="text-left px-5 py-3 font-medium">Registered</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registrations.map((r) => (
                    <tr key={r.id} className="hover:bg-teal-50/50 transition-colors group">
                      {/* Doors column — Multi */}
                      {VERSION !== 'Single' && (
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {r.doors.map((d) => (
                              <span key={d.doorId} className="inline-flex items-center gap-1 font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md text-xs border border-teal-200">
                                <Hash className="w-3 h-3 text-teal-400" />
                                {d.doorNumber}
                              </span>
                            ))}
                          </div>
                        </td>
                      )}
                      {/* Door column — Single: shows tied door from active transaction, or dash */}
                      {VERSION === 'Single' && (() => {
                        const tx = transactions.find((t) => t.rfid === r.rfid);
                        return (
                          <td className="px-5 py-3.5">
                            {tx ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-teal-50 text-teal-700 border-teal-200">
                                <Hash className="w-3 h-3" />
                                Door {tx.doorNumber}
                              </span>
                            ) : (
                              <span className="text-slate-300 italic text-xs">—</span>
                            )}
                          </td>
                        );
                      })()}
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
                          {VERSION !== 'Single' && (
                            <button
                              onClick={() => setEditingRecord(r)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-teal-600 p-1.5 rounded-lg hover:bg-teal-50 transition-all"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
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

        {/* Logs tab */}
        {activeTab === 'logs' && (
          <div className="bg-white border border-teal-100 rounded-2xl overflow-hidden shadow-sm">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <Clock className="w-8 h-8 opacity-30" />
                <p className="text-sm">No access logs yet.</p>
                <p className="text-xs text-slate-300">Logs appear here when tags are scanned at the kiosk.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Time</th>
                    <th className="text-left px-5 py-3 font-medium">Name</th>
                    <th className="text-left px-5 py-3 font-medium">RFID</th>
                    <th className="text-left px-5 py-3 font-medium">Door</th>
                    <th className="text-left px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 shrink-0" />
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {log.label ?? <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <code className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono">{log.rfid}</code>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md text-xs border border-teal-200">
                          <Hash className="w-3 h-3 text-teal-400" />
                          {log.doorNumber}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {log.action === 'checkin' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-green-50 text-green-700 border-green-200">
                            <DoorOpen className="w-3 h-3" />
                            Check-in
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                            <DoorClosed className="w-3 h-3" />
                            Check-out
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* ── Register modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white border border-teal-100 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {/* Step indicators */}
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${modalStep === 'scan' ? 'gradient-primary text-white' : 'bg-teal-100 text-teal-600'}`}>1</span>
                <div className={`w-8 h-0.5 rounded ${modalStep === 'label' ? 'bg-teal-400' : 'bg-slate-200'}`} />
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${modalStep === 'label' ? 'gradient-primary text-white' : 'bg-slate-100 text-slate-400'}`}>2</span>
                <span className="ml-2 text-sm font-semibold text-slate-700">
                  {modalStep === 'scan'
                    ? 'Scan RFID card'
                    : VERSION === 'Single' ? 'Add a name' : 'Add a label'}
                </span>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Door summary pill row — Multi mode only */}
            {VERSION !== 'Single' && (
              <div className="px-6 pt-4 flex flex-wrap gap-1.5">
                {selectedDoors.map((d) => (
                  <span key={d._id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 text-xs font-semibold border border-teal-200">
                    <Hash className="w-3 h-3" />
                    Door {d.number}
                  </span>
                ))}
              </div>
            )}

            {/* Step: scan */}
            {modalStep === 'scan' && (
              <div className="px-6 py-8 flex flex-col items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-teal-50 border-2 border-teal-200 flex items-center justify-center">
                  <ScanLine className="w-10 h-10 text-teal-500 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-800">Tap the RFID card on the scanner</p>
                  <p className="text-slate-400 text-sm mt-1">Waiting for card…</p>
                </div>
                <RfidScanner onScan={handleRfidScan} disabled={false} />
              </div>
            )}

            {/* Step: label */}
            {modalStep === 'label' && (
              <div className="px-6 py-6 space-y-5">
                {/* Scanned card badge */}
                <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-teal-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-teal-800">Card scanned</p>
                    <code className="text-xs text-teal-600 font-mono">{scannedRfid}</code>
                  </div>
                  <button
                    onClick={() => setModalStep('scan')}
                    className="ml-auto text-xs text-slate-400 hover:text-teal-600 transition-colors"
                  >
                    Re-scan
                  </button>
                </div>

                {/* Label input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    {VERSION === 'Single' ? 'Name' : 'Name / Label'}{' '}
                    <span className="text-slate-400 font-normal">
                      {VERSION === 'Single' ? '(optional)' : '(optional)'}
                    </span>
                  </label>
                  <input
                    ref={labelInputRef}
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                    placeholder={VERSION === 'Single' ? 'e.g. Juan dela Cruz' : "e.g. John's card"}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400 transition"
                  />
                  {VERSION === 'Single' && (
                    <p className="text-xs text-slate-400">
                      A door will be assigned automatically when this card is tapped.
                    </p>
                  )}
                </div>

                <button
                  onClick={handleRegister}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 gradient-primary hover:opacity-90 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-opacity shadow-md shadow-teal-500/20"
                >
                  {loading
                    ? <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <CheckCircle className="w-4 h-4" />}
                  {loading ? 'Registering…' : 'Save registration'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: 'teal' | 'green' | 'cyan';
}) {
  const colors = {
    teal:  'bg-teal-50 text-teal-600 border-teal-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    cyan:  'bg-cyan-50 text-cyan-600 border-cyan-200',
  };
  return (
    <div className="bg-white border border-teal-100 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function EditModal({ record, allDoors, registeredDoorIds, onSave, onClose }: {
  record: RfidRecord;
  allDoors: Door[];
  registeredDoorIds: Set<string>;
  onSave: (id: string, doors: DoorEntry[], label: string, rfid: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [selectedDoors, setSelectedDoors] = useState<DoorEntry[]>(record.doors);
  const [label, setLabel] = useState(record.label ?? '');
  const [editStep, setEditStep] = useState<'edit' | 'scan'>('edit');
  const [saving, setSaving] = useState(false);
  const [scanError, setScanError] = useState('');

  function toggleDoor(door: Door) {
    setSelectedDoors((prev) => {
      const exists = prev.find((d) => d.doorId === door._id);
      if (exists) return prev.filter((d) => d.doorId !== door._id);
      if (prev.length >= 3) return prev;
      return [...prev, { doorId: door._id, doorNumber: door.number }];
    });
  }

  async function handleScan(rfid: string) {
    if (saving) return;
    setSaving(true);
    setScanError('');
    const error = await onSave(record.id, selectedDoors, label, rfid);
    setSaving(false);
    if (error) setScanError(error);
  }

  const selectedDoorIds = new Set(selectedDoors.map((d) => d.doorId));
  const maxReached = selectedDoors.length >= 3;
  const selectedDoorObjects = allDoors.filter((d) => selectedDoorIds.has(d._id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white border border-teal-100 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${editStep === 'edit' ? 'gradient-primary text-white' : 'bg-teal-100 text-teal-600'}`}>1</span>
            <div className={`w-8 h-0.5 rounded ${editStep === 'scan' ? 'bg-teal-400' : 'bg-slate-200'}`} />
            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${editStep === 'scan' ? 'gradient-primary text-white' : 'bg-slate-100 text-slate-400'}`}>2</span>
            <span className="ml-2 text-sm font-semibold text-slate-700">
              {editStep === 'edit' ? 'Edit Tag' : 'Confirm with card'}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1 — Edit */}
        {editStep === 'edit' && (
          <>
            <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Label <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. John's card"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400 transition"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Doors <span className="text-slate-400 font-normal">(max 3)</span>
                </p>
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {selectedDoors.length === 0 && <span className="text-xs text-slate-400 self-center">No doors selected</span>}
                  {selectedDoorObjects.map((d) => (
                    <span key={d._id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold border border-teal-200">
                      <Hash className="w-3 h-3" />
                      Door {d.number}
                      <button onClick={() => toggleDoor(d)} className="hover:text-teal-900 ml-0.5"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  {!maxReached && selectedDoors.length > 0 && (
                    <span className="text-xs text-slate-400 self-center">{3 - selectedDoors.length} more allowed</span>
                  )}
                </div>
              </div>

              <DoorMatrix
                doors={allDoors}
                selectedDoorIds={selectedDoorIds}
                onSelect={toggleDoor}
                registeredDoorIds={registeredDoorIds}
                maxReached={maxReached}
              />
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-all">
                Cancel
              </button>
              <button
                onClick={() => setEditStep('scan')}
                disabled={selectedDoors.length === 0}
                className="flex items-center gap-2 px-4 py-2 gradient-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-opacity shadow-md shadow-teal-500/20"
              >
                <ScanLine className="w-4 h-4" />
                Continue — scan to confirm
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* Step 2 — Scan to confirm */}
        {editStep === 'scan' && (
          <div className="px-6 py-8 flex flex-col items-center gap-5">
            <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center transition-colors ${saving ? 'bg-teal-50 border-teal-300' : 'bg-teal-50 border-teal-200'}`}>
              {saving
                ? <span className="w-8 h-8 rounded-full border-4 border-teal-400 border-t-transparent animate-spin" />
                : <ScanLine className="w-10 h-10 text-teal-500 animate-pulse" />}
            </div>

            <div className="text-center">
              <p className="font-semibold text-slate-800">
                {saving ? 'Saving changes…' : 'Tap the RFID card to confirm'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {saving ? 'Please wait' : 'Scan the card that belongs to this registration'}
              </p>
            </div>

            {scanError && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 w-full">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {scanError}
              </div>
            )}

            <button
              onClick={() => { setEditStep('edit'); setScanError(''); }}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← Back to editing
            </button>

            <RfidScanner onScan={handleScan} disabled={saving} />
          </div>
        )}
      </div>
    </div>
  );
}
