import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  // TODO: switch on status when you build real DB logic
  return NextResponse.json({ count: status === "waiting-pickup" ? 2 : 0 });
}