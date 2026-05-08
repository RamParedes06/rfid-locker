/**
 * Async data-access layer backed by MongoDB.
 *
 * Drop-in replacement for the old JSON-file store.
 * All functions are now async and use Mongoose models.
 */
import { connectDB } from './mongoose';
import {
  RfidRecord as RfidModel,
  Transaction as TxModel,
  AccessLog as LogModel,
  IRfidRecord,
  ITransaction,
  IAccessLog,
} from './models';

// ─── Shared types (kept for compatibility with existing API routes / UI) ──────

export interface DoorEntry {
  doorId: string;
  doorNumber: number;
}

export interface RfidRecord {
  id: string;
  rfid: string;
  doors: DoorEntry[];
  label?: string;
  createdAt: string;
}

export interface RfidTransaction {
  id: string;
  rfid: string;
  lockerId: string;
  doorId: string;
  doorNumber: number;
  openedAt: string;
}

export interface AccessLog {
  id: string;
  rfid: string;
  label?: string;
  lockerId: string;
  doorNumber: number;
  action: 'checkin' | 'checkout';
  timestamp: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toRfidRecord(doc: IRfidRecord): RfidRecord {
  return {
    id:        doc._id.toString(),
    rfid:      doc.rfid,
    doors:     doc.doors.map((d) => ({ doorId: d.doorId, doorNumber: d.doorNumber })),
    label:     doc.label,
    createdAt: (doc as any).createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

function toTransaction(doc: ITransaction): RfidTransaction {
  return {
    id:         doc._id.toString(),
    rfid:       doc.rfid,
    lockerId:   doc.lockerId,
    doorId:     doc.doorId,
    doorNumber: doc.doorNumber,
    openedAt:   doc.openedAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

function toAccessLog(doc: IAccessLog): AccessLog {
  return {
    id:         doc._id.toString(),
    rfid:       doc.rfid,
    label:      doc.label,
    lockerId:   doc.lockerId,
    doorNumber: doc.doorNumber,
    action:     doc.action,
    timestamp:  doc.timestamp?.toISOString?.() ?? new Date().toISOString(),
  };
}

// ─── RFID records ─────────────────────────────────────────────────────────────

export const db = {
  getAll: async (): Promise<RfidRecord[]> => {
    await connectDB();
    const docs = await RfidModel.find().sort({ createdAt: -1 }).lean<IRfidRecord[]>();
    return docs.map((d) => toRfidRecord(d as unknown as IRfidRecord));
  },

  findByRfid: async (rfid: string): Promise<RfidRecord | null> => {
    await connectDB();
    const doc = await RfidModel.findOne({ rfid }).lean<IRfidRecord>();
    return doc ? toRfidRecord(doc as unknown as IRfidRecord) : null;
  },

  create: async (data: Omit<RfidRecord, 'id' | 'createdAt'>): Promise<RfidRecord> => {
    await connectDB();
    const doc = await RfidModel.create(data);
    return toRfidRecord(doc);
  },

  update: async (
    id: string,
    patch: { doors: DoorEntry[]; label?: string }
  ): Promise<RfidRecord | null> => {
    await connectDB();
    const doc = await RfidModel.findByIdAndUpdate(
      id,
      { doors: patch.doors, label: patch.label },
      { new: true }
    ).lean<IRfidRecord>();
    return doc ? toRfidRecord(doc as unknown as IRfidRecord) : null;
  },

  delete: async (id: string): Promise<boolean> => {
    await connectDB();
    const res = await RfidModel.findByIdAndDelete(id);
    return !!res;
  },
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export const txDb = {
  /** All active transactions (across all lockers) */
  getAll: async (): Promise<RfidTransaction[]> => {
    await connectDB();
    const docs = await TxModel.find().sort({ openedAt: -1 }).lean<ITransaction[]>();
    return docs.map((d) => toTransaction(d as unknown as ITransaction));
  },

  /** Active transaction for this RFID on ANY locker */
  findByRfid: async (rfid: string): Promise<RfidTransaction | null> => {
    await connectDB();
    const doc = await TxModel.findOne({ rfid }).lean<ITransaction>();
    return doc ? toTransaction(doc as unknown as ITransaction) : null;
  },

  /** Active transaction for this RFID on a SPECIFIC locker */
  findByRfidAndLocker: async (rfid: string, lockerId: string): Promise<RfidTransaction | null> => {
    await connectDB();
    const doc = await TxModel.findOne({ rfid, lockerId }).lean<ITransaction>();
    return doc ? toTransaction(doc as unknown as ITransaction) : null;
  },

  /** Door numbers already used by active transactions on a specific locker */
  usedDoorNumbers: async (lockerId: string): Promise<Set<number>> => {
    await connectDB();
    const docs = await TxModel.find({ lockerId }, { doorNumber: 1 }).lean();
    return new Set(docs.map((d: any) => d.doorNumber));
  },

  record: async (
    rfid: string,
    lockerId: string,
    doorId: string,
    doorNumber: number
  ): Promise<RfidTransaction> => {
    await connectDB();
    const doc = await TxModel.create({ rfid, lockerId, doorId, doorNumber });
    return toTransaction(doc);
  },

  deleteByRfid: async (rfid: string): Promise<boolean> => {
    await connectDB();
    const res = await TxModel.deleteOne({ rfid });
    return res.deletedCount > 0;
  },

  deleteByRfidAndLocker: async (rfid: string, lockerId: string): Promise<boolean> => {
    await connectDB();
    const res = await TxModel.deleteOne({ rfid, lockerId });
    return res.deletedCount > 0;
  },
};

// ─── Access Logs ──────────────────────────────────────────────────────────────

export const logDb = {
  getAll: async (): Promise<AccessLog[]> => {
    await connectDB();
    const docs = await LogModel.find().sort({ timestamp: -1 }).lean<IAccessLog[]>();
    return docs.map((d) => toAccessLog(d as unknown as IAccessLog));
  },

  getRecent: async (limit = 200): Promise<AccessLog[]> => {
    await connectDB();
    const docs = await LogModel.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean<IAccessLog[]>();
    return docs.map((d) => toAccessLog(d as unknown as IAccessLog));
  },

  append: async (entry: Omit<AccessLog, 'id' | 'timestamp'>): Promise<AccessLog> => {
    await connectDB();
    const doc = await LogModel.create(entry);
    return toAccessLog(doc);
  },
};
