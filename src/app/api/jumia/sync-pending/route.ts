import { NextResponse } from "next/server";
import { syncAllAccountsPendingOrders } from "@/lib/jumia/syncPendingOrders";

export async function POST() {
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
