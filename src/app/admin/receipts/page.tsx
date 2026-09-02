import React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import ReceiptsAdminClient from "@/app/receipts/ReceiptsAdminClient";
import { absUrl, withParams } from "@/lib/abs-url";
import WebsiteOrdersAdminClient from "@/app/admin/orders/website/WebsiteOrdersAdminClient";
import {
  ensureWebsiteOrdersSchema,
  serializeWebsiteOrders,
  websiteCheckoutOrderWhere,
  websiteOrderAdminInclude,
} from "@/lib/websiteOrders";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Force a desktop viewport for this admin page so mobile devices render
// the desktop UI (exclude from mobile-optimized layout).
export const viewport = {
  // Use a fixed desktop width to prevent mobile scaling/stacking
  width: "1024",
  initialScale: 1,
};

export default async function AdminReceiptsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; orderId?: string }>;
}) {
  try {
    const params = (await searchParams) || {};
    const activeTab =
      params.tab === "website-orders" ? "website-orders" : "receipts";

    if (activeTab === "website-orders") {
      await ensureWebsiteOrdersSchema();
      const orders = await prisma.websiteOrder.findMany({
        where: {
          ...websiteCheckoutOrderWhere,
        },
        include: websiteOrderAdminInclude,
        orderBy: [{ createdAt: "desc" }],
      });
      const serializedOrders = await serializeWebsiteOrders(orders);

      return (
        <main className="min-h-screen w-full bg-slate-950 text-slate-100">
          <div className="w-full px-4 py-6 lg:px-8 xl:px-12">
            <WebsiteOrdersAdminClient
              initialOrders={serializedOrders}
              initialExpandedId={params.orderId?.trim() || null}
            />
          </div>
        </main>
      );
    }

    const incomingHeaders = await headers();
    const cookieHeader = incomingHeaders.get("cookie") ?? undefined;
    const apiUrl = await absUrl("/api/receipts");
    const res = await fetch(
      withParams(apiUrl, {
        includeItems: true,
        scope: "global",
        onlyPos: "1",
        includeLedger: false,
      }),
      {
        cache: "no-store",
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      },
    );
    const j = await res.json();
    const receipts: unknown[] = j.receipts || [];

    return (
      <main className="min-h-screen w-full bg-slate-950 text-slate-100">
        <div className="w-full px-4 py-6 lg:px-8 xl:px-12">
          <div className="mb-4 flex flex-wrap gap-2">
            <Link
              href="/admin/lipa-pole-pole"
              className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300"
            >
              Lipa Pole Pole Accounts
            </Link>
            <Link
              href="/admin/quotation-center"
              className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400"
            >
              Admin Quotation Center
            </Link>
            <Link
              href="/marketing/receipts?tab=quotations"
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/20"
            >
              Staff Quotations
            </Link>
          </div>
          <ReceiptsAdminClient
            initial={receipts as never[]}
            allowEdit
            scope="global"
            onlyPos
            includeLedger={false}
          />
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
