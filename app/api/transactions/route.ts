import { NextResponse } from 'next/server';
import { txDb } from '@/lib/db';

// GET /api/transactions — list all active transactions (across all lockers)
export async function GET() {
  const txs = await txDb.getAll();
  return NextResponse.json(txs);
}
