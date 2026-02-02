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
    const res = await fetch(withParams(apiUrl, { includeItems: true, scope: "global" }), {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    const j = await res.json();
    const receipts = j.receipts || [];
    return (
      <div className="mx-auto max-w-5xl p-4">
        <h1 className="mb-4 text-2xl font-semibold">Admin - Receipts</h1>
        <ReceiptsAdminClient initial={receipts} allowEdit scope="global" />
      </div>
    );
  } catch (e) {
    console.error("Failed to load receipts for admin page", e);
    return <div className="p-4">Failed to load receipts</div>;
  }
}
