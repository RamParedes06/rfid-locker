import { NextResponse } from 'next/server';
import { logDb } from '@/lib/db';

// GET /api/logs — return access logs, most recent first
export async function GET() {
  return NextResponse.json(logDb.getRecent(200));
}
