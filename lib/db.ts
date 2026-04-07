/**
 * Simple JSON file-based store for RFID registrations.
 * Each record maps an RFID tag to a door number.
 * Replace with a real DB (Postgres, Mongo, etc.) as needed.
 */
import fs from 'fs';
import path from 'path';

export interface RfidRecord {
  id: string;       // uuid
  rfid: string;     // the scanned RFID tag value
  doorId: string;   // door _id from the locker API
  doorNumber: number;
  label?: string;   // optional friendly name
  createdAt: string;
}

const DB_PATH = path.join(process.cwd(), 'data', 'rfid.json');

function read(): RfidRecord[] {
  if (!fs.existsSync(DB_PATH)) return [];
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function write(records: RfidRecord[]) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
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

  delete: (id: string): boolean => {
    const records = read();
    const filtered = records.filter((r) => r.id !== id);
    if (filtered.length === records.length) return false;
    write(filtered);
    return true;
  },
};
