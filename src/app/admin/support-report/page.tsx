import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import ClientSupportReport from "./ClientSupportReport";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const resolveOrigin = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

const AdminSupportReportPage = async ({ searchParams }: { searchParams?: Promise<SearchParams | undefined> }) => {
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") {
    return redirect("/not-authorized");
  }

  const basePeriod = getTradingPeriodFor(new Date());
  const fromParam = Array.isArray(resolvedSearchParams.from) ? resolvedSearchParams.from[0] : resolvedSearchParams.from;
  const toParam = Array.isArray(resolvedSearchParams.to) ? resolvedSearchParams.to[0] : resolvedSearchParams.to;
  const day = Array.isArray(resolvedSearchParams.day) ? resolvedSearchParams.day[0] : resolvedSearchParams.day ?? "";
  const attendantId = Array.isArray(resolvedSearchParams.attendantId) ? resolvedSearchParams.attendantId[0] : resolvedSearchParams.attendantId ?? "";
  const search = Array.isArray(resolvedSearchParams.search) ? resolvedSearchParams.search[0] : resolvedSearchParams.search ?? "";

  const fromDate = fromParam && !Number.isNaN(new Date(fromParam).getTime()) ? fromParam : basePeriod.start.toISOString().split("T")[0];
  const toDate = toParam && !Number.isNaN(new Date(toParam).getTime()) ? toParam : basePeriod.end.toISOString().split("T")[0];

  const query = new URLSearchParams();
  query.set("from", fromDate);
  query.set("to", toDate);
  if (day) query.set("day", day);
  if (attendantId) query.set("attendantId", attendantId);
  if (search) query.set("search", search);

  const origin = resolveOrigin();
  const cookieHeader = cookies().toString();
  const res = await fetch(`${origin}/api/admin/support-report?${query.toString()}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to load support report data");
  }

  const data = await res.json();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-7xl p-6">
        <ClientSupportReport
          periodLabel={data.periodLabel}
          entries={data.entries}
          summary={data.summary}
          initialFilters={{ from: fromDate, to: toDate, day, attendantId, search }}
        />
      </main>
    </div>
  );
};

export default AdminSupportReportPage;
