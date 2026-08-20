import { noStoreJson, requireRoleOrBrendah } from "@/lib/api";
import {
  combineMarketingProductActivity,
  getManualMarketplaceProductActivity,
  getMarketingProductActivity,
} from "@/lib/marketingProductActivity";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor, parseTradingPeriodKey } from "@/lib/tradingPeriod";

export const dynamic = "force-dynamic";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const sessionUser = auth.session?.user as { id?: string; email?: string | null } | undefined;
  const requestedTarget = auth.role === "ADMIN" ? searchParams.get("impersonateId")?.trim() : null;
  const targetId = requestedTarget || sessionUser?.id;
  if (!targetId) return noStoreJson({ error: "User not found" }, { status: 404 });

  const target = await prisma.user.findFirst({
    where: {
      id: targetId,
      email: { equals: "brendah@betech.co.ke", mode: "insensitive" },
      isActive: true,
    },
    select: { id: true, email: true },
  });
  if (!target) return noStoreJson({ error: "Product activity is only available for Brendah" }, { status: 403 });

  const requestedDate = searchParams.get("date")?.trim() || "";
  if (!DATE_KEY_PATTERN.test(requestedDate)) {
    return noStoreJson({ error: "A valid date is required" }, { status: 400 });
  }

  const requestedPeriod = parseTradingPeriodKey(searchParams.get("periodKey") ?? undefined) ??
    getTradingPeriodFor(new Date(`${requestedDate}T12:00:00+03:00`));
  const [periodStart, periodEnd] = requestedPeriod.key.split("_");
  const [websiteDaily, websitePeriod, marketplaceDaily, marketplacePeriod] = await Promise.all([
    getMarketingProductActivity({
      userId: target.id,
      startDate: requestedDate,
      client: prisma,
    }),
    getMarketingProductActivity({
      userId: target.id,
      startDate: periodStart,
      endDate: periodEnd,
      client: prisma,
    }),
    getManualMarketplaceProductActivity({
      userId: target.id,
      userEmail: target.email,
      startDate: requestedDate,
      client: prisma,
    }),
    getManualMarketplaceProductActivity({
      userId: target.id,
      userEmail: target.email,
      startDate: periodStart,
      endDate: periodEnd,
      client: prisma,
    }),
  ]);

  const daily = combineMarketingProductActivity(websiteDaily, marketplaceDaily.total);
  const period = combineMarketingProductActivity(websitePeriod, marketplacePeriod.total);

  return noStoreJson({
    ok: true,
    source: "WEBSITE_ACTION_LOG_AND_MANUAL_MARKETPLACE_REPORTS",
    date: requestedDate,
    period: { key: requestedPeriod.key, label: requestedPeriod.label },
    daily,
    periodTotals: period,
    website: { daily: websiteDaily, periodTotals: websitePeriod },
    marketplaces: { daily: marketplaceDaily, periodTotals: marketplacePeriod },
  });
}
