import { NextResponse } from "next/server";
import { syncAllAccountsPendingOrders } from "@/lib/jumia/syncPendingOrders";

async function handle(request: Request) {
  try {
    const results = await syncAllAccountsPendingOrders();
    return NextResponse.json({ ok: true, results });
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
