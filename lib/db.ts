/**
 * Simple JSON file-based store for RFID registrations.
 *
 * Multi mode: each record maps an RFID tag to 1–3 doors (multi-access).
 * Single mode: each record maps an RFID tag to a name only; a separate
 *              transactions file tracks which door was opened per tag.
 */
import fs from 'fs';
import path from 'path';

// ─── Shared types ────────────────────────────────────────────────────────────

export interface DoorEntry {
  doorId: string;
  doorNumber: number;
}

export interface RfidRecord {
  id: string;
  rfid: string;
  doors: DoorEntry[];   // Multi: 1–3 doors. Single: always []
  label?: string;
  createdAt: string;
}

// ─── Transaction (Single mode) ───────────────────────────────────────────────

export interface RfidTransaction {
  id: string;
  rfid: string;
  doorId: string;
  doorNumber: number;
  openedAt: string;
}

// ─── File paths ──────────────────────────────────────────────────────────────

const DATA_DIR   = path.join(process.cwd(), 'data');
const DB_PATH    = path.join(DATA_DIR, 'rfid.json');
const TX_PATH    = path.join(DATA_DIR, 'transactions.json');

// ─── RFID records ────────────────────────────────────────────────────────────

function read(): RfidRecord[] {
  if (!fs.existsSync(DB_PATH)) return [];
  const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  // Migrate legacy single-door records
  return raw.map((r: any) => {
    if (!r.doors) {
      return { ...r, doors: [{ doorId: r.doorId, doorNumber: r.doorNumber }] };
    }
    return r;
  });
}

function write(records: RfidRecord[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(records, null, 2));
}

export const db = {
  getAll: (): RfidRecord[] => read(),

  findByRfid: (rfid: string): RfidRecord | undefined =>
    read().find((r) => r.rfid === rfid),

  create: (record: Omit<RfidRecord, 'id' | 'createdAt'>): RfidRecord => {
    const records = read();
    const newRecord: RfidRecord = {
      ...record,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    write([...records, newRecord]);
    return newRecord;
  },

  update: (id: string, patch: { doors: DoorEntry[]; label?: string }): RfidRecord | null => {
    const records = read();
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    records[idx] = { ...records[idx], doors: patch.doors, label: patch.label };
    write(records);
    return records[idx];
  },

  delete: (id: string): boolean => {
    const records = read();
    const filtered = records.filter((r) => r.id !== id);
    if (filtered.length === records.length) return false;
    write(filtered);
    return true;
  },
};

// ─── Access Log ──────────────────────────────────────────────────────────────

export interface AccessLog {
  id: string;
  rfid: string;
  label?: string;
  doorNumber: number;
  action: 'checkin' | 'checkout';
  timestamp: string;
}

const LOG_PATH = path.join(DATA_DIR, 'logs.json');

function readLogs(): AccessLog[] {
  if (!fs.existsSync(LOG_PATH)) return [];
  return JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
}

function writeLogs(logs: AccessLog[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));
}

export const logDb = {
  getAll: (): AccessLog[] => readLogs(),

  /** Most recent first, optional limit */
  getRecent: (limit = 200): AccessLog[] =>
    readLogs().slice(-limit).reverse(),

  append: (entry: Omit<AccessLog, 'id' | 'timestamp'>): AccessLog => {
    const logs = readLogs();
    const log: AccessLog = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    writeLogs([...logs, log]);
    return log;
  },
};

function readTx(): RfidTransaction[] {
  if (!fs.existsSync(TX_PATH)) return [];
  return JSON.parse(fs.readFileSync(TX_PATH, 'utf-8'));
}

function writeTx(txs: RfidTransaction[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TX_PATH, JSON.stringify(txs, null, 2));
}

export const txDb = {
  getAll: (): RfidTransaction[] => readTx(),

  /** Returns the transaction for this RFID if it already opened a door */
  findByRfid: (rfid: string): RfidTransaction | undefined =>
    readTx().find((t) => t.rfid === rfid),

  /** Returns all door numbers that already have a transaction */
  usedDoorNumbers: (): Set<number> =>
    new Set(readTx().map((t) => t.doorNumber)),

  record: (rfid: string, doorId: string, doorNumber: number): RfidTransaction => {
    const txs = readTx();
    const tx: RfidTransaction = {
      id: crypto.randomUUID(),
      rfid,
      doorId,
      doorNumber,
      openedAt: new Date().toISOString(),
    };
    writeTx([...txs, tx]);
    return tx;
  },

  /** Remove a transaction (admin reset) */
  deleteByRfid: (rfid: string): boolean => {
    const txs = readTx();
    const filtered = txs.filter((t) => t.rfid !== rfid);
    if (filtered.length === txs.length) return false;
    writeTx(filtered);
    return true;
  },
};
