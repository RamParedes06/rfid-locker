import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/rfid/scan — look up RFID and return its assigned doors
export async function POST(req: NextRequest) {
  const { rfid } = await req.json();

  if (!rfid) {
    return NextResponse.json({ error: 'rfid is required' }, { status: 400 });
  }

  const record = db.findByRfid(rfid);
  if (!record) {
    return NextResponse.json({ error: 'RFID not registered' }, { status: 404 });
  }

  return NextResponse.json({
    id: record.id,
    label: record.label,
    doors: record.doors,
  });
}
