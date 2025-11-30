import { startOfDay, endOfDay } from "date-fns";
import ClientAdminMarketingReport from "./ClientAdminMarketingReport";
import { getMarketingReport } from "@/lib/marketingReport";
import { getRecentTradingPeriods, getTradingPeriodFor } from "@/lib/tradingPeriod";

type AdminSearchParams = Record<string, string | string[] | undefined> | undefined;

const AdminMarketingReportPage = async (...args: any[]) => {
  const props = args[0] ?? {};
  const searchParams = (props?.searchParams as AdminSearchParams) ?? undefined;
  const periods = getRecentTradingPeriods(12);
  const selectedPeriod =
    (searchParams?.period &&
      periods.find((period) => period.key === searchParams.period)) ||
    getTradingPeriodFor(new Date());

  const dow = Array.isArray(searchParams?.dow) ? searchParams?.dow[0] : searchParams?.dow || "";
  const dateStrRaw = Array.isArray(searchParams?.date) ? searchParams?.date[0] : searchParams?.date;
  const userSearch = Array.isArray(searchParams?.user) ? searchParams?.user[0] : searchParams?.user;

  const parsedDate = dateStrRaw ? new Date(dateStrRaw) : undefined;
  const validDate = parsedDate && !Number.isNaN(parsedDate.getTime());
  const from = validDate ? startOfDay(parsedDate) : undefined;
  const to = validDate ? endOfDay(parsedDate) : undefined;

  const report = await getMarketingReport({
    tradingPeriodKey: selectedPeriod.key,
    dayOfWeek: dow || undefined,
    from,
    to,
    userFilter: userSearch,
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-7xl p-6">
        <ClientAdminMarketingReport
          entries={report.entries}
          aggregates={report.aggregates}
          selectedPeriodKey={selectedPeriod.key}
          dow={dow}
          dateStr={validDate && dateStrRaw ? dateStrRaw : ""}
          userFilter={userSearch ?? ""}
        />
    </main>
  </div>
  );
};

export default AdminMarketingReportPage;

export const dynamic = "force-dynamic";
