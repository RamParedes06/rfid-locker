import { NextResponse } from 'next/server';
import { logDb } from '@/lib/db';

// GET /api/logs — return access logs, most recent first
export async function GET() {
  const logs = await logDb.getRecent(200);
  return NextResponse.json(logs);
}
