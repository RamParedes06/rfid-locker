import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/rfid/:id — update doors and/or label
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { doors, label } = body;

  if (!Array.isArray(doors) || doors.length === 0) {
    return NextResponse.json({ error: 'doors[] is required' }, { status: 400 });
  }
  if (doors.length > 3) {
    return NextResponse.json({ error: 'Maximum 3 doors allowed per RFID card' }, { status: 400 });
  }

  const updated = db.update(params.id, { doors, label });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/rfid/:id — remove a registration
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const deleted = db.delete(params.id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
