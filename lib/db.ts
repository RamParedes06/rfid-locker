/**
 * Simple JSON file-based store for RFID registrations.
 * Each record maps an RFID tag to 1–3 doors.
 */
import fs from 'fs';
import path from 'path';

export interface DoorEntry {
  doorId: string;
  doorNumber: number;
}

export interface RfidRecord {
  id: string;
  rfid: string;
  doors: DoorEntry[];   // 1–3 doors
  label?: string;
  createdAt: string;
}

const DB_PATH = path.join(process.cwd(), 'data', 'rfid.json');

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
