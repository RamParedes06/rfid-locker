import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/rfid — list all registrations
export async function GET() {
  return NextResponse.json(db.getAll());
}

// POST /api/rfid — register a new RFID tag to a door
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { rfid, doorId, doorNumber, label } = body;

  if (!rfid || !doorId || doorNumber == null) {
    return NextResponse.json({ error: 'rfid, doorId, and doorNumber are required' }, { status: 400 });
  }

  // Prevent duplicate RFID registrations
  const existing = db.findByRfid(rfid);
  if (existing) {
    return NextResponse.json(
      { error: `RFID already registered to door ${existing.doorNumber}` },
      { status: 409 }
    );
  }

  const record = db.create({ rfid, doorId, doorNumber, label });
  return NextResponse.json(record, { status: 201 });
}
