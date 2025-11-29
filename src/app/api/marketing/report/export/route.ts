import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { getMarketingReport } from "@/lib/marketingReport";

export const dynamic = "force-dynamic";

const quote = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const day = url.searchParams.get("dow") || url.searchParams.get("dayOfWeek");

  const from = fromStr ? new Date(fromStr) : undefined;
  const to = toStr ? new Date(toStr) : undefined;

  const { entries } = await getMarketingReport({ from, to, dayOfWeek: day || undefined });

  const header = [
    "Date",
    "Day",
    "TotalSalesKES",
    "TotalProfitKES",
    "TikTokPosted",
    "TikTokReplied",
    "IGFBYTPosted",
    "IGFBYTReplied",
    "WhatsAppStatus",
    "WhatsAppContacts",
    "WhatsAppReplied",
    "StockEnough",
    "ShopCleaned",
    "ShopWellArranged",
    "DisplayWellLabeled",
    "ItemsCount",
    "LiveSessionsCount",
    "LiveEstimatedViewers",
    "LiveDurationMinutes",
    "LivePlatform",
    "WeeklyComment",
    "SubmittedBy",
    "Payload",
  ];

  const rows = entries.map((e) => [
    e.date.split("T")[0],
    e.dayOfWeek,
    e.totalSales,
    e.totalProfit,
    e.tiktokPosted2Videos || e.tiktokPosted4ExplanatoryVideos || e.shot4ProductVideos ? "Yes" : "No",
    e.tiktokRepliedAll ? "Yes" : "No",
    e.igFbYtPosted2VideosEach ? "Yes" : "No",
    e.igFbYtRepliedAll ? "Yes" : "No",
    e.waPostedStatus || e.waPosted10Statuses ? "Yes" : "No",
    e.waSavedContacts || e.waSaved10Contacts ? "Yes" : "No",
    e.waRespondedAll ? "Yes" : "No",
    e.stockEnoughFastMovers ? "Yes" : "No",
    e.shopCleaned ? "Yes" : "No",
    e.shopWellArranged ? "Yes" : "No",
    e.displayWellLabeled ? "Yes" : "No",
    (e.sales || []).reduce((sum, s) => sum + (Number((s as any).itemsCount) || 1), 0),
    e.liveSessionsCount ?? "",
    e.liveSessionsEstimatedViewers ?? e.liveViewers ?? "",
    e.liveSessionDurationMinutes ?? "",
    e.liveSessionPlatform ?? "",
    e.weeklyComment ?? "",
    e.submittedByEmail || e.submittedByName || "",
    JSON.stringify(e.payload || {}),
  ]);

  const csv = [header.map(quote).join(","), ...rows.map((row) => row.map(quote).join(","))].join("\n");
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=marketing-report.csv",
    },
  });
}
