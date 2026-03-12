import React from "react";
import { headers } from "next/headers";
import ReceiptsAdminClient from "@/app/receipts/ReceiptsAdminClient";
import { absUrl, withParams } from "@/lib/abs-url";

export const dynamic = "force-dynamic";

// Force a desktop viewport for this admin page so mobile devices render
// the desktop UI (exclude from mobile-optimized layout).
export const viewport = {
  // Use a fixed desktop width to prevent mobile scaling/stacking
  width: "1024",
  initialScale: 1,
};

export default async function AdminReceiptsPage() {
  try {
    const apiUrl = await absUrl("/api/receipts");
    const incomingHeaders = await headers();
    const cookieHeader = incomingHeaders.get("cookie") ?? undefined;
    const res = await fetch(withParams(apiUrl, { includeItems: true, scope: "global", onlyPos: "1" }), {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    const j = await res.json();
    const receipts = j.receipts || [];
    return (
      <main className="min-h-screen w-full bg-slate-950 text-slate-100">
        <div className="w-full px-4 py-6 lg:px-8 xl:px-12">
          <ReceiptsAdminClient initial={receipts} allowEdit scope="global" onlyPos />
        </div>
      </main>
    );
  } catch (e) {
    console.error("Failed to load receipts for admin page", e);
    return (
      <div className="min-h-screen w-full bg-slate-950 p-6 text-slate-100">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-6">
          Failed to load receipts
        </div>
      </div>
    );
  }
}
