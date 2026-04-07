import { NextResponse } from 'next/server';
import { httpRequest } from '@/lib/httpRequest';

// GET /api/doors — fetch door matrix from locker API
export async function GET() {
  const lockerId = process.env.NEXT_PUBLIC_LOCKER_ID;
  if (!lockerId) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_LOCKER_ID not configured' }, { status: 500 });
  }

  const data = await httpRequest(`lockers/${lockerId}/door-matrix`);
  if (data?.error) {
    return NextResponse.json({ error: data.message }, { status: 502 });
  }

  return NextResponse.json(data);
}
