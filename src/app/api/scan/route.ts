import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code } = body ?? {};
    if (!code) return NextResponse.json({ action: 'INVALID', reason: 'no-code' }, { status: 400 });

    // Very small stub logic for demo purposes
    if (typeof code === 'string' && code.startsWith('ORD-')) {
      return NextResponse.json({ action: 'FIND_ORDER', orderId: code.replace('ORD-', '') });
    }

    if (typeof code === 'string' && code.startsWith('PKG-')) {
      return NextResponse.json({ action: 'CONFIRM_PACKAGE', packageId: code.replace('PKG-', '') });
    }

    return NextResponse.json({ action: 'UNKNOWN', code });
  } catch (err) {
    return new NextResponse(String(err), { status: 500 });
  }
}
