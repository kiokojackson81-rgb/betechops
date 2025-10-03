import { noStoreJson, requireRole } from "@/lib/api";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  // TODO: upsert new/updated orders since cursor per shop
  return noStoreJson({ ok: true, accepted: true });
}
