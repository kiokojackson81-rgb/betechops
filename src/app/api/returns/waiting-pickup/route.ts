import { NextResponse } from "next/server";
import { getReturnsWaitingPickup } from "@/lib/jumia";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { count } = await getReturnsWaitingPickup();
    return NextResponse.json({ count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ count: 0, error: msg }, { status: 200 });
  }
}