import { noStoreJson, requireRole } from "@/lib/api";
import { syncOrdersIncremental } from "@/lib/jobs/jumia";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Allow headless cron via secret (header or query): x-cron-secret / cronSecret
  const url = new URL(request.url);
  const cronSecretHeader = request.headers.get("x-cron-secret") || "";
  const cronSecretQuery = (url.searchParams.get("cronSecret") || "").trim();
  const cronSecretEnv = (process.env.CRON_SECRET || "").trim();
  const isCron = !!cronSecretEnv && (cronSecretHeader === cronSecretEnv || cronSecretQuery === cronSecretEnv);

  if (!isCron) {
    const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
    if (!auth.ok) return auth.res;
  }

  const opts: { shopId?: string; lookbackDays?: number } = {};
  const shopIdParam = url.searchParams.get("shopId");
  if (shopIdParam) opts.shopId = shopIdParam;
  const lookbackParam = url.searchParams.get("lookbackDays");
  if (lookbackParam) {
    const parsed = Number.parseInt(lookbackParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) opts.lookbackDays = parsed;
  }

  try {
    const summary = await syncOrdersIncremental(opts);
    if (isCron) {
      const res = NextResponse.json({ ok: true, cron: true, summary });
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
    return noStoreJson({ ok: true, summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return noStoreJson({ ok: false, error: message }, { status: 500 });
  }
}
