import { NextRequest, NextResponse } from 'next/server';
import { db, txDb, logDb } from '@/lib/db';
import { getHardwareController } from '@/lib/hardwareController';
import { httpRequest } from '@/lib/httpRequest';

const VERSION = process.env.VERSION_CONTROL ?? 'Multi';

// POST /api/rfid/scan — look up RFID and return its assigned doors (Multi)
//                       or auto-open the next available door (Single)
export async function POST(req: NextRequest) {
  const { rfid } = await req.json();

  if (!rfid) {
    return NextResponse.json({ error: 'rfid is required' }, { status: 400 });
  }

  const record = db.findByRfid(rfid);
  if (!record) {
    return NextResponse.json({ error: 'RFID not registered' }, { status: 404 });
  }

  // ── Multi mode ────────────────────────────────────────────────────────────
  if (VERSION !== 'Single') {
    return NextResponse.json({
      id: record.id,
      label: record.label,
      doors: record.doors,
    });
  }

  // ── Single mode ───────────────────────────────────────────────────────────
  // 1st tap: no transaction → find next available door → open → save transaction
  // 2nd tap: has transaction → open the same door again → delete transaction
  // 3rd tap: back to 1st tap behaviour (cycle repeats)

  const existingTx = txDb.findByRfid(rfid);

  if (existingTx) {
    // ── 2nd tap: re-open the tied door and clear the transaction ─────────
    try {
      const hw = getHardwareController();
      const result = await hw.locker.openDoor([existingTx.doorId]);
      if (!result.completed) {
        return NextResponse.json(
          { error: 'Failed to open door', detail: result.error },
          { status: 500 }
        );
      }
    } catch (err: any) {
      console.error('Hardware open door failed:', err);
      return NextResponse.json({ error: 'Failed to open door', detail: err.message }, { status: 500 });
    }

    // Remove the transaction — RFID is free again
    txDb.deleteByRfid(rfid);

    // Log the checkout
    logDb.append({ rfid, label: record.label, doorNumber: existingTx.doorNumber, action: 'checkout' });

    return NextResponse.json({
      id: record.id,
      label: record.label,
      doorNumber: existingTx.doorNumber,
      action: 'checkout',
    });
  }

  // ── 1st tap: assign and open the next available door ─────────────────────
  const lockerId = process.env.NEXT_PUBLIC_LOCKER_ID;
  if (!lockerId) {
    return NextResponse.json({ error: 'Locker not configured' }, { status: 500 });
  }

  const matrixData = await httpRequest(`lockers/${lockerId}/door-matrix`);
  if (matrixData?.error) {
    return NextResponse.json({ error: 'Failed to fetch door matrix' }, { status: 502 });
  }

  // Flatten the door matrix (units → columns → doors) — same shape as /api/doors
  type RawDoor = { _id: string; number: number; status: string; isScreen?: boolean };
  const units: any[] = Array.isArray(matrixData) ? matrixData : matrixData?.units ?? [];
  const allDoors: RawDoor[] = units.flatMap((unit: any) =>
    (unit.columns ?? []).flatMap((col: any) => col.doors ?? [])
  );

  // Doors already used by transactions
  const usedDoorNumbers = txDb.usedDoorNumbers();

  // Filter: available, not a screen, not already used by another transaction
  const availableDoors = allDoors
    .filter((d) => !d.isScreen && d.status === 'available' && !usedDoorNumbers.has(d.number))
    .sort((a, b) => a.number - b.number);

  if (availableDoors.length === 0) {
    return NextResponse.json({ error: 'No available doors at this time' }, { status: 503 });
  }

  // Pick the lowest door number (linear)
  const nextDoor = availableDoors[0];

  // Open the door via hardware
  try {
    const hw = getHardwareController();

    // Resolve the hardware doorId from the locker SDK if possible
    const doorsResult = await hw.locker.getDoors();
    let doorId: string = `door_${nextDoor.number}`;

    if (doorsResult.completed && doorsResult.data?.doors) {
      const rawDoors = doorsResult.data.doors as Record<string, any>;
      const match = Object.values(rawDoors).find(
        (d: any) =>
          d.doorId === `door_${nextDoor.number}` ||
          String(d.channelId) === String(nextDoor.number) ||
          d.doorId?.endsWith(`_${nextDoor.number}`)
      );
      if (match?.doorId) doorId = match.doorId;
    }

    const result = await hw.locker.openDoor([doorId]);
    if (!result.completed) {
      return NextResponse.json(
        { error: 'Failed to open door', detail: result.error },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error('Hardware open door failed:', err);
    return NextResponse.json({ error: 'Failed to open door', detail: err.message }, { status: 500 });
  }

  // Record the transaction
  const tx = txDb.record(rfid, nextDoor._id, nextDoor.number);

  // Log the check-in
  logDb.append({ rfid, label: record.label, doorNumber: nextDoor.number, action: 'checkin' });

  return NextResponse.json({
    id: record.id,
    label: record.label,
    doorNumber: nextDoor.number,
    openedAt: tx.openedAt,
  });
}
