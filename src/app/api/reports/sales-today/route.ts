import { NextResponse } from "next/server";
import { getSalesToday } from "@/lib/jumia";

export async function GET() {
  try {
    const { total } = await getSalesToday();
    return NextResponse.json({ total });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ total: 0, error: msg }, { status: 200 });
  }
}
