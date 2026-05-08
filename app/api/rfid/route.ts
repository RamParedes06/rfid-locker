import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const VERSION = process.env.VERSION_CONTROL ?? 'Multi';

// GET /api/rfid — list all registrations
export async function GET() {
  const records = await db.getAll();
  return NextResponse.json(records);
}

// POST /api/rfid — register an RFID tag
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { rfid, doors, label } = body;

  if (!rfid) {
    return NextResponse.json({ error: 'rfid is required' }, { status: 400 });
  }

  const existing = await db.findByRfid(rfid);
  if (existing) {
    return NextResponse.json(
      { error: `RFID already registered${existing.label ? ` (${existing.label})` : ''}` },
      { status: 409 }
    );
  }

  if (VERSION === 'Single') {
    const record = await db.create({ rfid, doors: [], label });
    return NextResponse.json(record, { status: 201 });
  }

  // Multi mode — doors are required
  if (!Array.isArray(doors) || doors.length === 0) {
    return NextResponse.json({ error: 'rfid and doors[] are required' }, { status: 400 });
  }
  if (doors.length > 3) {
    return NextResponse.json({ error: 'Maximum 3 doors allowed per RFID card' }, { status: 400 });
  }
  for (const d of doors) {
    if (!d.doorId || d.doorNumber == null) {
      return NextResponse.json(
        { error: 'Each door entry must have doorId and doorNumber' },
        { status: 400 }
      );
    }
  }

  const record = await db.create({ rfid, doors, label });
  return NextResponse.json(record, { status: 201 });
}
