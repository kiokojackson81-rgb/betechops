import { NextResponse } from 'next/server';
import { getUserShops } from '@/lib/assignments';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id') || request.headers.get('x-cc-user') || 'anonymous';
    const shops = await getUserShops(userId);
    // Stub: return shops and an empty orders list. Real implementation will query provider.
    return NextResponse.json({ shops, orders: [] });
  } catch (err) {
    return new NextResponse(String(err), { status: 500 });
  }
}
