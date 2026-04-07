import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getHardwareController } from '@/lib/hardwareController';

// POST /api/rfid/scan — called when an RFID tag is scanned on the kiosk
export async function POST(req: NextRequest) {
  const { rfid } = await req.json();

  if (!rfid) {
    return NextResponse.json({ error: 'rfid is required' }, { status: 400 });
  }

  const record = db.findByRfid(rfid);
  if (!record) {
    return NextResponse.json({ error: 'RFID not registered' }, { status: 404 });
  }

  try {
    const doorId = `door_${record.doorNumber}`;
    const result = await getHardwareController().locker.openDoor([doorId]);
    if (!result.completed) {
      console.error('Hardware open door failed:', result.error);
      return NextResponse.json({ error: 'Failed to open door', detail: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, door: record.doorNumber, label: record.label });
  } catch (err: any) {
    console.error('Hardware open door failed:', err);
    return NextResponse.json({ error: 'Failed to open door', detail: err.message }, { status: 500 });
  }
}
