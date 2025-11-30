import { getMarketingReport } from "@/lib/marketingReport";
import SummaryPanelClient from "./SummaryPanelClient";
import MultiDayExportClient from "./MultiDayExportClient";
import { startOfDay, endOfDay, formatISO } from "date-fns";
import { auth } from "@/lib/auth";
import { getTradingPeriodFor, getRecentTradingPeriods } from "@/lib/tradingPeriod";
import ClientAdminMarketingReport from "./ClientAdminMarketingReport";

export const dynamic = "force-dynamic";

export default async function MarketingReportPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = searchParams ? await searchParams : undefined;
  const periodKey = typeof sp?.period === "string" ? sp.period : "";
  const dow = typeof sp?.dow === "string" ? sp.dow : "";
  const dateStr = typeof sp?.date === "string" ? sp.date : "";
  const userFilter = typeof sp?.user === "string" ? sp.user : "";

  const currentPeriod = getTradingPeriodFor(new Date());
  const selectedPeriod = (periodKey && getRecentTradingPeriods(12).find((p) => p.key === periodKey)) || currentPeriod;

  const { entries, aggregates } = await getMarketingReport({
    tradingPeriodKey: selectedPeriod.key,
    dayOfWeek: dow || undefined,
    from: dateStr ? new Date(dateStr) : undefined,
    to: dateStr ? new Date(dateStr) : undefined,
    submittedById: userFilter || undefined,
  });

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const initialFrom = formatISO(todayStart);
  const initialTo = formatISO(todayEnd);

  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  const isAdmin = role === "ADMIN";

  return (
    <ClientAdminMarketingReport
      entries={entries}
      aggregates={aggregates}
      selectedPeriodKey={selectedPeriod?.key}
      dow={dow}
      dateStr={dateStr}
      initialFrom={initialFrom}
      initialTo={initialTo}
      isAdmin={isAdmin}
    />
  );
}
