import { NextResponse } from "next/server";
import { getSalesToday, getPendingPricingCount, getReturnsWaitingPickup } from "@/lib/jumia";

type Probe<T> = { ok: true; ms: number; data: T } | { ok: false; ms: number; error: string };

async function probe<T>(fn: () => Promise<T>): Promise<Probe<T>> {
  const t0 = Date.now();
  try {
    const data = await fn();
    return { ok: true, ms: Date.now() - t0, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, ms: Date.now() - t0, error: msg };
  }
}

export async function GET() {
  const [salesToday, pendingPricing, returnsWaitingPickup] = await Promise.all([
    probe(() => getSalesToday()),
    probe(() => getPendingPricingCount()),
    probe(() => getReturnsWaitingPickup()),
  ]);

  const ok = salesToday.ok || pendingPricing.ok || returnsWaitingPickup.ok;

  return NextResponse.json({
    ok,
    salesToday,
    pendingPricing,
    returnsWaitingPickup,
    timestamp: new Date().toISOString(),
  });
}
