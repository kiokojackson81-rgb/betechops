import { noStoreJson, requireRole } from "@/lib/api";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;
  // TODO: parse CSV and upsert CostCatalog rows
  return noStoreJson({ ok: true, accepted: true });
}
