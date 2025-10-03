// Server component: shows a small operational status banner for Admin
import { AlertTriangle, Info } from "lucide-react";

type Health = {
  status: string;
  productCount: number;
  authReady: boolean;
  timestamp: string;
  dbOk?: boolean;
  hasDatabaseUrl?: boolean;
  dbScheme?: string | null;
  dbHost?: string | null;
};

export default async function AdminStatusBanner() {
  let health: Health | null = null;
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/health`, { cache: "no-store" });
    // In most cases we’re on the same origin; fallback to relative if absolute fails
    if (!r.ok) throw new Error(`health ${r.status}`);
    health = (await r.json()) as Health;
  } catch {
    try {
      const r2 = await fetch(`/api/health`, { cache: "no-store" });
      if (r2.ok) health = (await r2.json()) as Health;
    } catch {
      // ignore
    }
  }

  if (!health) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
        Unable to reach /api/health. Check deployment and network.
      </div>
    );
  }

  const issues: string[] = [];
  if (!health.dbOk) issues.push("Database not reachable or migrations not applied");
  if (!health.authReady) issues.push("NextAuth env vars not set (NEXTAUTH_SECRET, Google client)");

  if (issues.length === 0) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm px-3 py-2 flex items-center gap-2">
        <Info className="h-4 w-4" />
        <span>System OK</span>
        <span className="opacity-70">•</span>
        <span>Products: {health.productCount}</span>
        {typeof health.dbHost === "string" && (
          <>
            <span className="opacity-70">•</span>
            <span>DB: {health.dbScheme || "?"} @{health.dbHost}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-sm px-3 py-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5" />
        <div>
          <div className="font-medium">Operational warnings</div>
          <ul className="list-disc ml-5">
            {issues.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
          <div className="mt-1 opacity-80">
            See <a className="underline" href="/admin/health-checks">Admin → Health Checks</a> for details.
          </div>
        </div>
      </div>
    </div>
  );
}
