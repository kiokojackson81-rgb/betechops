// Server component: shows a small operational status banner for Admin
import { AlertTriangle, Info } from "lucide-react";
import { headers } from "next/headers";
import { ReactNode } from "react";

type Health = {
  status: string;
  productCount: number;
  authReady: boolean;
  timestamp: string;
  dbOk?: boolean;
  hasDatabaseUrl?: boolean;
  dbScheme?: string | null;
  dbHost?: string | null;
  dbError?: string | null;
};

export default async function AdminStatusBanner() {
  let health: Health | null = null;
  // Construct absolute origin from headers to satisfy Node fetch
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const origin = host ? `${proto}://${host}` : "";
  try {
    const r = await fetch(`${origin}/api/health`, { cache: "no-store" });
    if (r.ok) health = (await r.json()) as Health;
  } catch {
    // ignore
  }

  if (!health) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
        Unable to reach /api/health. Check deployment and network.
      </div>
    );
  }

  const issues: ReactNode[] = [];
  if (health.hasDatabaseUrl === false) {
    issues.push("DATABASE_URL env var is not configured");
  }
  if (!health.dbOk) {
    if (health.dbError) {
      issues.push(
        <span>
          Database error:
          <code className="block text-xs mt-1 rounded bg-white/10 px-2 py-1 text-yellow-100">{health.dbError}</code>
        </span>,
      );
    } else {
      issues.push("Database not reachable or migrations not applied");
    }
  }
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
