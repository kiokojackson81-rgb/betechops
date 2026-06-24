import React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import ReceiptsAdminClient from "@/app/receipts/ReceiptsAdminClient";
import { absUrl, withParams } from "@/lib/abs-url";
import WebsiteOrdersAdminClient from "@/app/admin/orders/website/WebsiteOrdersAdminClient";
import { ensureWebsiteOrdersSchema, serializeWebsiteOrders, websiteOrderAdminInclude } from "@/lib/websiteOrders";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Force a desktop viewport for this admin page so mobile devices render
// the desktop UI (exclude from mobile-optimized layout).
export const viewport = {
  // Use a fixed desktop width to prevent mobile scaling/stacking
  width: "1024",
  initialScale: 1,
};

const receiptAdminTabs = [
  { key: "receipts", label: "Receipts", href: "/admin/receipts" },
  { key: "catalogue", label: "Catalogue", href: "/admin/pos-management" },
  { key: "customers", label: "Customers", href: "/admin/customers" },
  { key: "shop-images", label: "Shop Images", href: "/admin/settings/shop-images" },
  { key: "salesops", label: "SalesOps", href: "/admin/marketing-report?impersonateId=cmimxqf9t0003v5mcjdq8x61p" },
  { key: "pricing", label: "Pricing", href: "/admin/pending-pricing" },
  { key: "returns", label: "Returns", href: "/admin/returns" },
  { key: "website-orders", label: "Website Orders", href: "/admin/receipts?tab=website-orders" },
] as const;

export default async function AdminReceiptsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  try {
    const params = (await searchParams) || {};
    const activeTab = params.tab === "website-orders" ? "website-orders" : "receipts";
    const incomingHeaders = await headers();
    const cookieHeader = incomingHeaders.get("cookie") ?? undefined;
    let receipts: unknown[] = [];
    let serializedOrders: Awaited<ReturnType<typeof serializeWebsiteOrders>> = [];

    if (activeTab === "website-orders") {
      await ensureWebsiteOrdersSchema();
      const orders = await prisma.websiteOrder.findMany({
        include: websiteOrderAdminInclude,
        orderBy: [{ createdAt: "desc" }],
      });
      serializedOrders = await serializeWebsiteOrders(orders);
    } else {
      const apiUrl = await absUrl("/api/receipts");
      const res = await fetch(withParams(apiUrl, { includeItems: true, scope: "global", onlyPos: "1", includeLedger: false }), {
        cache: "no-store",
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      });
      const j = await res.json();
      receipts = j.receipts || [];
    }

    return (
      <main className="min-h-screen w-full bg-slate-950 text-slate-100">
        <div className="w-full px-4 py-6 lg:px-8 xl:px-12">
          <div className="space-y-6">
            <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,.96),rgba(2,6,23,.98))] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Admin receipts</div>
                  <h1 className="mt-2 text-3xl font-semibold text-white">
                    {activeTab === "website-orders" ? "Website Orders Monitoring" : "Receipts Operations"}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-slate-400">
                    {activeTab === "website-orders"
                      ? "Review pending website orders from within the receipts area before routing them into downstream fulfilment."
                      : "Manage POS receipts, customer documents, and direct-sales records from one admin desk."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {receiptAdminTabs.map((tab) => {
                    const isActive = activeTab === tab.key || (activeTab === "receipts" && tab.key === "receipts");
                    return (
                      <Link
                        key={tab.key}
                        href={tab.href}
                        className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                          isActive
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            : "border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 hover:bg-white/[0.05]"
                        }`}
                      >
                        {tab.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>

            {activeTab === "website-orders" ? (
              <WebsiteOrdersAdminClient initialOrders={serializedOrders} />
            ) : (
              <ReceiptsAdminClient initial={receipts as never[]} allowEdit scope="global" onlyPos includeLedger={false} />
            )}
          </div>
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
