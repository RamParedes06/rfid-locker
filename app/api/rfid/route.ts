import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/rfid — list all registrations
export async function GET() {
  return NextResponse.json(db.getAll());
}

// POST /api/rfid — register an RFID tag to 1–3 doors
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { rfid, doors, label } = body;

  if (!rfid || !Array.isArray(doors) || doors.length === 0) {
    return NextResponse.json(
      { error: 'rfid and doors[] are required' },
      { status: 400 }
    );
  }

  if (doors.length > 3) {
    return NextResponse.json(
      { error: 'Maximum 3 doors allowed per RFID card' },
      { status: 400 }
    );
  }

  for (const d of doors) {
    if (!d.doorId || d.doorNumber == null) {
      return NextResponse.json(
        { error: 'Each door entry must have doorId and doorNumber' },
        { status: 400 }
      );
    }
  }

  const existing = db.findByRfid(rfid);
  if (existing) {
    return NextResponse.json(
      { error: `RFID already registered (${existing.doors.map((d) => `#${d.doorNumber}`).join(', ')})` },
      { status: 409 }
    );
  }

  const record = db.create({ rfid, doors, label });
  return NextResponse.json(record, { status: 201 });
}
