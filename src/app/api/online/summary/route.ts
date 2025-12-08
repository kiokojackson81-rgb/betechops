import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/online/summary?userId=<id>
 * Returns all WeeklySale rows for the given user.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }
  const sales = await prisma.weeklySale.findMany({ where: { userId } });
  return NextResponse.json(sales);
}

/**
 * POST /api/online/summary
 * Creates a new WeeklySale entry.  Expects JSON body: { userId, shopId?, weekStart, weekEnd, amount, status }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, shopId, weekStart, weekEnd, amount, status } = body;
    if (!userId || !weekStart || !weekEnd || amount == null) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const sale = await prisma.weeklySale.create({
      data: {
        userId,
        shopId,
        weekStart: new Date(weekStart),
        weekEnd: new Date(weekEnd),
        amount,
        status: status || 'PENDING',
      },
    });
    return NextResponse.json(sale, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
