import { noStoreJson, requireRole } from "@/lib/api";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;
  // TODO: parse and insert SettlementRow[]; trigger profit recompute window
  return noStoreJson({ ok: true, accepted: true });
}
