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
    const hw = getHardwareController();

    // Fetch actual door IDs from SDK config
    const doorsResult = await hw.locker.getDoors();
    let doorId: string;

    if (doorsResult.completed && doorsResult.data?.doors) {
      const doors = doorsResult.data.doors;
      // Match by door number — find the door whose key or doorId ends with the number
      const match = Object.values(doors).find(
        (d: any) => d.doorId === `door_${record.doorNumber}` || String(d.channelId) === String(record.doorNumber) || d.doorId?.endsWith(`_${record.doorNumber}`)
      );
      doorId = match?.doorId ?? Object.keys(doors)[record.doorNumber - 1] ?? `door_${record.doorNumber}`;
    } else {
      doorId = `door_${record.doorNumber}`;
    }

    const result = await hw.locker.openDoor([doorId]);
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
