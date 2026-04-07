import { NextRequest, NextResponse } from 'next/server';
import { getHardwareController } from '@/lib/hardwareController';

// POST /api/rfid/open — open a specific door by doorNumber
export async function POST(req: NextRequest) {
  const { doorNumber } = await req.json();

  if (doorNumber == null) {
    return NextResponse.json({ error: 'doorNumber is required' }, { status: 400 });
  }

  try {
    const hw = getHardwareController();

    const doorsResult = await hw.locker.getDoors();
    let doorId: string;

    if (doorsResult.completed && doorsResult.data?.doors) {
      const doors = doorsResult.data.doors;
      const match = Object.values(doors).find(
        (d: any) =>
          d.doorId === `door_${doorNumber}` ||
          String(d.channelId) === String(doorNumber) ||
          d.doorId?.endsWith(`_${doorNumber}`)
      );
      doorId = match?.doorId ?? Object.keys(doors)[doorNumber - 1] ?? `door_${doorNumber}`;
    } else {
      doorId = `door_${doorNumber}`;
    }

    const result = await hw.locker.openDoor([doorId]);
    if (!result.completed) {
      return NextResponse.json({ error: 'Failed to open door', detail: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, door: doorNumber });
  } catch (err: any) {
    console.error('Hardware open door failed:', err);
    return NextResponse.json({ error: 'Failed to open door', detail: err.message }, { status: 500 });
  }
}
