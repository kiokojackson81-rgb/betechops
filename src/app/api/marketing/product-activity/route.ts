import { noStoreJson, requireRoleOrBrendah } from "@/lib/api";
import {
  combineMarketingProductActivity,
  getManualMarketplaceProductActivity,
  getMarketingProductActivity,
} from "@/lib/marketingProductActivity";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MANUAL_MARKETPLACE_SOURCE = "MANUAL_MARKETPLACE_PRODUCT_ACTIVITY";
const MARKETPLACE_KEYS = [
  "jumiaProductsUploaded",
  "jumiaProductsEdited",
  "jumiaProductsCopied",
  "kilimallProductsUploaded",
  "kilimallProductsEdited",
  "kilimallProductsCopied",
] as const;

type AuthorizedSession = {
  role: string;
  session?: { user?: { id?: string; email?: string | null } } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function dateBounds(date: string) {
  return {
    start: new Date(`${date}T00:00:00+03:00`),
    end: new Date(`${date}T23:59:59.999+03:00`),
  };
}

async function resolveTarget(request: Request, auth: AuthorizedSession) {
  const { searchParams } = new URL(request.url);
  const sessionUser = auth.session?.user;
  const requestedTarget = auth.role === "ADMIN" ? searchParams.get("impersonateId")?.trim() : null;
  const targetId = requestedTarget || sessionUser?.id;
  if (!targetId) return null;

  return prisma.user.findFirst({
    where: {
      id: targetId,
      email: { equals: "brendah@betech.co.ke", mode: "insensitive" },
      isActive: true,
    },
    select: { id: true, email: true, name: true },
  });
}

async function buildActivityPayload(input: {
  target: { id: string; email: string | null };
  requestedDate: string;
  periodKey?: string | null;
}) {
  const requestedPeriod = parseTradingPeriodKey(input.periodKey ?? undefined) ??
    getTradingPeriodFor(new Date(`${input.requestedDate}T12:00:00+03:00`));
  const [periodStart, periodEnd] = requestedPeriod.key.split("_");
  const [websiteDaily, websitePeriod, marketplaceDaily, marketplacePeriod] = await Promise.all([
    getMarketingProductActivity({
      userId: input.target.id,
      startDate: input.requestedDate,
      client: prisma,
    }),
    getMarketingProductActivity({
      userId: input.target.id,
      startDate: periodStart,
      endDate: periodEnd,
      client: prisma,
    }),
    getManualMarketplaceProductActivity({
      userId: input.target.id,
      userEmail: input.target.email,
      startDate: input.requestedDate,
      client: prisma,
    }),
    getManualMarketplaceProductActivity({
      userId: input.target.id,
      userEmail: input.target.email,
      startDate: periodStart,
      endDate: periodEnd,
      client: prisma,
    }),
  ]);

  return {
    ok: true,
    source: "WEBSITE_ACTION_LOG_AND_MANUAL_MARKETPLACE_REPORTS",
    date: input.requestedDate,
    period: { key: requestedPeriod.key, label: requestedPeriod.label },
    daily: combineMarketingProductActivity(websiteDaily, marketplaceDaily.total),
    periodTotals: combineMarketingProductActivity(websitePeriod, marketplacePeriod.total),
    website: { daily: websiteDaily, periodTotals: websitePeriod },
    marketplaces: { daily: marketplaceDaily, periodTotals: marketplacePeriod },
  };
}

export async function GET(request: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const target = await resolveTarget(request, auth as AuthorizedSession);
  if (!target) return noStoreJson({ error: "Product activity is only available for Brendah" }, { status: 403 });

  const requestedDate = searchParams.get("date")?.trim() || "";
  if (!DATE_KEY_PATTERN.test(requestedDate)) {
    return noStoreJson({ error: "A valid date is required" }, { status: 400 });
  }

  return noStoreJson(await buildActivityPayload({
    target,
    requestedDate,
    periodKey: searchParams.get("periodKey"),
  }));
}

export async function POST(request: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const target = await resolveTarget(request, auth as AuthorizedSession);
  if (!target) return noStoreJson({ error: "Product activity is only available for Brendah" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const requestedDate = isRecord(body) && typeof body.date === "string" ? body.date.trim() : "";
  if (!DATE_KEY_PATTERN.test(requestedDate)) {
    return noStoreJson({ error: "A valid date is required" }, { status: 400 });
  }

  const jumia = isRecord(body) && isRecord(body.jumia) ? body.jumia : {};
  const kilimall = isRecord(body) && isRecord(body.kilimall) ? body.kilimall : {};
  const numeric = {
    jumiaProductsUploaded: normalizeCount(jumia.uploaded),
    jumiaProductsEdited: normalizeCount(jumia.edited),
    jumiaProductsCopied: normalizeCount(jumia.copied),
    kilimallProductsUploaded: normalizeCount(kilimall.uploaded),
    kilimallProductsEdited: normalizeCount(kilimall.edited),
    kilimallProductsCopied: normalizeCount(kilimall.copied),
  };
  const { start, end } = dateBounds(requestedDate);

  await prisma.$transaction(async (tx) => {
    const entries = await tx.marketingDailyEntry.findMany({
      where: { submittedById: target.id, date: { gte: start, lte: end } },
      select: { id: true, payload: true },
    });
    const dedicated = entries.find((entry) =>
      isRecord(entry.payload) && entry.payload.source === MANUAL_MARKETPLACE_SOURCE,
    );

    // Older full-report submissions may contain these fields. Zero them so the
    // dedicated daily record remains the single source of truth.
    for (const entry of entries) {
      if (entry.id === dedicated?.id || !isRecord(entry.payload)) continue;
      const existingNumeric = isRecord(entry.payload.numeric) ? entry.payload.numeric : {};
      if (!MARKETPLACE_KEYS.some((key) => normalizeCount(existingNumeric[key]) > 0)) continue;
      const nextNumeric = { ...existingNumeric };
      MARKETPLACE_KEYS.forEach((key) => { nextNumeric[key] = 0; });
      await tx.marketingDailyEntry.update({
        where: { id: entry.id },
        data: { payload: { ...entry.payload, numeric: nextNumeric } as Prisma.InputJsonValue },
      });
    }

    const payload = {
      source: MANUAL_MARKETPLACE_SOURCE,
      numeric,
      yesNo: {},
      text: {},
    } satisfies Prisma.InputJsonObject;
    if (dedicated) {
      await tx.marketingDailyEntry.update({ where: { id: dedicated.id }, data: { payload } });
    } else {
      const date = new Date(`${requestedDate}T12:00:00+03:00`);
      await tx.marketingDailyEntry.create({
        data: {
          date,
          dayOfWeek: new Intl.DateTimeFormat("en-KE", { weekday: "long", timeZone: "Africa/Nairobi" }).format(date),
          totalSales: 0,
          totalProfit: 0,
          payload,
          submittedById: target.id,
          submittedByName: target.name,
          submittedByEmail: target.email,
        },
      });
    }
  });

  const periodKey = isRecord(body) && typeof body.periodKey === "string" ? body.periodKey : null;
  return noStoreJson(await buildActivityPayload({ target, requestedDate, periodKey }));
}
