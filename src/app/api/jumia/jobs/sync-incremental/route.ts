import { noStoreJson, requireRole } from "@/lib/api";
import { syncOrdersIncremental } from "@/lib/jobs/jumia";

async function handle(request: Request) {
  // This is deliberately an authenticated, on-demand operation. Scheduled and
  // fire-and-forget callers caused overlapping broad syncs in production.
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);

  const opts: { shopId?: string; lookbackDays?: number } = {};
  const shopIdParam = url.searchParams.get("shopId");
  if (shopIdParam) opts.shopId = shopIdParam;
  const lookbackParam = url.searchParams.get("lookbackDays");
  if (lookbackParam) {
    const parsed = Number.parseInt(lookbackParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) opts.lookbackDays = Math.min(parsed, 7);
  }
  // Keep every manual refresh bounded, including when no query parameter is supplied.
  if (!opts.lookbackDays) opts.lookbackDays = 3;

  try {
    const summary = await syncOrdersIncremental(opts);
    return noStoreJson({ ok: true, summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return noStoreJson({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
