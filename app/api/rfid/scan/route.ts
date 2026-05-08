import { NextRequest, NextResponse } from 'next/server';
import { db, txDb, logDb } from '@/lib/db';
import { getHardwareController } from '@/lib/hardwareController';
import { httpRequest } from '@/lib/httpRequest';

const VERSION = process.env.VERSION_CONTROL ?? 'Multi';

// POST /api/rfid/scan
export async function POST(req: NextRequest) {
  const { rfid } = await req.json();

  if (!rfid) {
    return NextResponse.json({ error: 'rfid is required' }, { status: 400 });
  }

  const lockerId = process.env.NEXT_PUBLIC_LOCKER_ID;
  if (!lockerId) {
    return NextResponse.json({ error: 'Locker not configured (NEXT_PUBLIC_LOCKER_ID missing)' }, { status: 500 });
  }

  const record = await db.findByRfid(rfid);
  if (!record) {
    return NextResponse.json({ error: 'RFID not registered' }, { status: 404 });
  }

  // ── Multi mode ────────────────────────────────────────────────────────────
  if (VERSION !== 'Single') {
    return NextResponse.json({
      id:    record.id,
      label: record.label,
      doors: record.doors,
    });
  }

  // ── Single mode ───────────────────────────────────────────────────────────
  // Cross-locker check: does this RFID have an active transaction anywhere?
  const anyTx = await txDb.findByRfid(rfid);

  if (anyTx) {
    // Transaction exists on THIS locker → checkout flow
    if (anyTx.lockerId === lockerId) {
      try {
        const hw = getHardwareController();
        const result = await hw.locker.openDoor([anyTx.doorId]);
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

      await txDb.deleteByRfidAndLocker(rfid, lockerId);
      await logDb.append({
        rfid,
        label:      record.label,
        lockerId,
        doorNumber: anyTx.doorNumber,
        action:     'checkout',
      });

      return NextResponse.json({
        id:         record.id,
        label:      record.label,
        doorNumber: anyTx.doorNumber,
        action:     'checkout',
      });
    }

    // Transaction exists on a DIFFERENT locker → block with friendly message
    return NextResponse.json(
      {
        error:    `You have an existing transaction in Locker #${anyTx.lockerId}. Please check out there first.`,
        lockedAt: anyTx.lockerId,
        doorNumber: anyTx.doorNumber,
      },
      { status: 409 }
    );
  }

  // ── No existing transaction → check-in flow ───────────────────────────────
  const matrixData = await httpRequest(`lockers/${lockerId}/door-matrix`);
  if (matrixData?.error) {
    return NextResponse.json({ error: 'Failed to fetch door matrix' }, { status: 502 });
  }

  type RawDoor = { _id: string; number: number; status: string; isScreen?: boolean };
  const units: any[] = Array.isArray(matrixData) ? matrixData : matrixData?.units ?? [];
  const allDoors: RawDoor[] = units.flatMap((unit: any) =>
    (unit.columns ?? []).flatMap((col: any) => col.doors ?? [])
  );

  const usedDoorNumbers = await txDb.usedDoorNumbers(lockerId);

  const availableDoors = allDoors
    .filter((d) => !d.isScreen && d.status === 'available' && !usedDoorNumbers.has(d.number))
    .sort((a, b) => a.number - b.number);

  if (availableDoors.length === 0) {
    return NextResponse.json({ error: 'No available doors at this time' }, { status: 503 });
  }

  const nextDoor = availableDoors[0];

  try {
    const hw = getHardwareController();
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

  const tx = await txDb.record(rfid, lockerId, nextDoor._id, nextDoor.number);

  await logDb.append({
    rfid,
    label:      record.label,
    lockerId,
    doorNumber: nextDoor.number,
    action:     'checkin',
  });

  return NextResponse.json({
    id:         record.id,
    label:      record.label,
    doorNumber: nextDoor.number,
    openedAt:   tx.openedAt,
  });
}
