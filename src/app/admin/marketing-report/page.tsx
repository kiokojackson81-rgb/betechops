import { startOfDay, endOfDay } from "date-fns";
import ClientAdminMarketingReport from "./ClientAdminMarketingReport";
import { getMarketingReport } from "@/lib/marketingReport";
import { getRecentTradingPeriods, getTradingPeriodFor } from "@/lib/tradingPeriod";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

type AdminSearchParams = {
  period?: string | string[];
  dow?: string | string[];
  date?: string | string[];
  user?: string | string[];
};

type AdminMarketingReportPageProps = {
  searchParams?: AdminSearchParams;
};

const getFirstParam = (value?: string | string[]) => {
  if (!value) return "";
  return Array.isArray(value) ? value[0] ?? "" : value;
};

const AdminMarketingReportPage = async ({ searchParams }: AdminMarketingReportPageProps) => {
  // server-side guard: only ADMIN may access this page
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "ADMIN") return redirect("/not-authorized");

  const periods = getRecentTradingPeriods(12);
  const selectedPeriodKey = getFirstParam(searchParams?.period);
  const selectedPeriod =
    periods.find((period) => period.key === selectedPeriodKey) ?? getTradingPeriodFor(new Date());

  const dow = getFirstParam(searchParams?.dow);
  const dateStrRaw = getFirstParam(searchParams?.date);
  const userSearch = getFirstParam(searchParams?.user);

  const parsedDate = dateStrRaw ? new Date(dateStrRaw) : undefined;
  const validDate = parsedDate && !Number.isNaN(parsedDate.getTime());
  const from = validDate ? startOfDay(parsedDate as Date) : undefined;
  const to = validDate ? endOfDay(parsedDate as Date) : undefined;

  const report = await getMarketingReport({
    tradingPeriodKey: selectedPeriod.key,
    dayOfWeek: dow || undefined,
    from,
    to,
    userFilter: userSearch || undefined,
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
