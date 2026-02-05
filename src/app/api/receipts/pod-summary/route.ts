import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({});
  } catch (err) {
    return NextResponse.json({}, { status: 500 });
  }
}
