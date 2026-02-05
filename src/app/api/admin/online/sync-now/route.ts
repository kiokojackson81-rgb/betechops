import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api';
import { syncOnlineMarketplaceData } from '@/lib/jobs/onlineSync';
import { mondayToSundayNairobiWindow } from '@/lib/weekWindow';

export async function POST(request: Request) {
  const auth = await requireRole(['ADMIN']);
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const dayParam = url.searchParams.get('day');
  const day = dayParam ? new Date(dayParam) : new Date();
  const window = mondayToSundayNairobiWindow(day);

  try {
    const result = await syncOnlineMarketplaceData({ periodStart: window.weekStart, periodEnd: window.weekEnd });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
