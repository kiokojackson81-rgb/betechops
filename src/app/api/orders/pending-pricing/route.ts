import { NextResponse } from "next/server";

export async function GET() {
  // TODO: replace with real query from Prisma
  return NextResponse.json({ count: 3 });
}