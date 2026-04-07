import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE /api/rfid/:id — remove a registration
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const deleted = db.delete(params.id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
