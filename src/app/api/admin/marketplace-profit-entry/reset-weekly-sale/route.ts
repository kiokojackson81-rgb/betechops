import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { upsertManualWeeklySale } from "@/lib/manualWeeklySaleUpsert";
import { maybeAutoSendDividedWhatsappReport } from "@/lib/dividedWhatsapp";
import { maybeAutoSendPricingWeekWhatsapp } from "@/lib/pricingWeekWhatsapp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;

  const body = (await req.json().catch(() => null)) as
    | {
        shopId?: string;
        weekStart?: string;
        weekEnd?: string;
        accountId?: string;
      }
    | null;
  if (!body || !isRecord(body)) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const shopId = String(body.shopId ?? "").trim();
  if (!shopId) return NextResponse.json({ error: "shopId is required" }, { status: 400 });

  const weekStartIso = String(body.weekStart ?? "").trim();
  if (!weekStartIso) return NextResponse.json({ error: "weekStart is required" }, { status: 400 });

  const weekStart = new Date(weekStartIso);
  if (Number.isNaN(weekStart.getTime())) return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });

  // Derive effective user from the marketplace account assignment (optional).
  let effectiveUserId: string | null = null;
  const accountId = String(body.accountId ?? "").trim();
  if (accountId) {
    const primary = await prisma.marketplaceAccountAssignment.findFirst({
      where: { accountId, endsAt: null },
      orderBy: { startsAt: "desc" },
      select: { attendantId: true },
    });
    effectiveUserId = primary?.attendantId ?? null;
  }

  // Week end is optional; upsert helper canonicalizes to Mon–Sun Nairobi.
  const weekEndIso = String(body.weekEnd ?? "").trim();
  const weekEnd = weekEndIso ? new Date(weekEndIso) : new Date(weekStart);

  await upsertManualWeeklySale({
    shopId,
    weekStart,
    weekEnd,
    amount: 0,
    userId: effectiveUserId,
    actorId,
  });

  try {
    if (actorId) {
      await maybeAutoSendDividedWhatsappReport({
        weekStartRaw: weekStart.toISOString().slice(0, 10),
        actorId,
        source: "reset-weekly-sale",
      });
      await maybeAutoSendPricingWeekWhatsapp({
        weekStartRaw: weekStart.toISOString().slice(0, 10),
        actorId,
        source: "reset-weekly-sale",
      });
    }
  } catch (err) {
    console.error("[reset-weekly-sale] auto-send failed", err);
  }
  return NextResponse.json({ ok: true });
}

