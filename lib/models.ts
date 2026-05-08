/**
 * Mongoose models for the RFID Locker system.
 *
 * Collections:
 *  - rfidrecords   — registered RFID cards
 *  - transactions  — active check-ins (one per RFID at a time, across all lockers)
 *  - accesslogs    — immutable audit trail
 */
import mongoose, { Schema, Document, Model } from 'mongoose';

// ─── RfidRecord ──────────────────────────────────────────────────────────────

export interface IDoorEntry {
  doorId: string;
  doorNumber: number;
}

export interface IRfidRecord extends Document {
  rfid: string;
  doors: IDoorEntry[];
  label?: string;
  createdAt: Date;
}

const DoorEntrySchema = new Schema<IDoorEntry>(
  {
    doorId:     { type: String, required: true },
    doorNumber: { type: Number, required: true },
  },
  { _id: false }
);

const RfidRecordSchema = new Schema<IRfidRecord>(
  {
    rfid:  { type: String, required: true, unique: true, index: true },
    doors: { type: [DoorEntrySchema], default: [] },
    label: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const RfidRecord: Model<IRfidRecord> =
  mongoose.models.RfidRecord ??
  mongoose.model<IRfidRecord>('RfidRecord', RfidRecordSchema);

// ─── Transaction ─────────────────────────────────────────────────────────────

export interface ITransaction extends Document {
  rfid: string;
  lockerId: string;   // which locker this check-in belongs to
  doorId: string;
  doorNumber: number;
  openedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    rfid:       { type: String, required: true, index: true },
    lockerId:   { type: String, required: true, index: true },
    doorId:     { type: String, required: true },
    doorNumber: { type: Number, required: true },
    openedAt:   { type: Date,   default: () => new Date() },
  },
  { timestamps: false }
);

export const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ??
  mongoose.model<ITransaction>('Transaction', TransactionSchema);

// ─── AccessLog ───────────────────────────────────────────────────────────────

export interface IAccessLog extends Document {
  rfid: string;
  label?: string;
  lockerId: string;
  doorNumber: number;
  action: 'checkin' | 'checkout';
  timestamp: Date;
}

const AccessLogSchema = new Schema<IAccessLog>(
  {
    rfid:       { type: String, required: true, index: true },
    label:      { type: String },
    lockerId:   { type: String, required: true, index: true },
    doorNumber: { type: Number, required: true },
    action:     { type: String, enum: ['checkin', 'checkout'], required: true },
    timestamp:  { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

export const AccessLog: Model<IAccessLog> =
  mongoose.models.AccessLog ??
  mongoose.model<IAccessLog>('AccessLog', AccessLogSchema);
