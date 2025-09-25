import { NextResponse } from "next/server";
import { getSalesToday } from "@/lib/jumia";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { total } = await getSalesToday();
    return NextResponse.json({ total });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ total: 0, error: msg }, { status: 200 });
  }
}
