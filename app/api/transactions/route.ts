import { NextResponse } from 'next/server';
import { txDb } from '@/lib/db';

// GET /api/transactions — list all active transactions
export async function GET() {
  return NextResponse.json(txDb.getAll());
}
