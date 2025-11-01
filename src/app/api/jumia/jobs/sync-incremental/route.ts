import { noStoreJson, requireRole } from "@/lib/api";
import { syncOrdersIncremental } from "@/lib/jobs/jumia";

export async function POST() {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  try {
    const summary = await syncOrdersIncremental();
    return noStoreJson({ ok: true, summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return noStoreJson({ ok: false, error: message }, { status: 500 });
  }
}
