import { NextResponse } from 'next/server';
import { updateKpisCacheExact } from '@/lib/jobs/kpis';

export async function POST() {
  try {
    const payload = await updateKpisCacheExact();
    return NextResponse.json({ ok: true, payload });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}

export async function GET() {
  // Allow GET for convenience (idempotent cache recompute)
  return POST();
}
