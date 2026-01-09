import { NextResponse } from "next/server";
import { syncAllAccountsPendingOrders } from "@/lib/jumia/syncPendingOrders";
import { syncOnlineMarketplaceData } from "@/lib/jobs/onlineSync";

async function handle(request: Request) {
  try {
    const results = await syncAllAccountsPendingOrders();
    // Also sync marketplace delivered items (Jumia order items)
    let marketplaceSummary: any = null;
    try {
      marketplaceSummary = await syncOnlineMarketplaceData({ lookbackDays: Number(process.env.JUMIA_MARKETPLACE_SYNC_LOOKBACK_DAYS ?? 90) });
    } catch (err) {
      console.error('[api.jumia.sync-pending] marketplace sync failed', err);
      marketplaceSummary = { error: String((err as Error)?.message ?? err) };
    }
    return NextResponse.json({ ok: true, results, marketplace: marketplaceSummary });
  } catch (error) {
    console.error("[api.jumia.sync-pending] failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return handle(request);
}

// Allow Vercel Cron to invoke via GET
export async function GET(request: Request) {
  return handle(request);
}
