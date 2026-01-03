import { NextResponse } from "next/server";
import { getOrCreateCommissionPeriod } from "@/lib/commission";
import { nowInNairobi } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = nowInNairobi();
  await getOrCreateCommissionPeriod(today);
  return NextResponse.json({ ok: true, date: today.toISOString() });
}
