import { noStoreJson, requireRole } from "@/lib/api";

export async function POST(_req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  // TODO: create product feed
  return noStoreJson({ ok: true, accepted: true });
}
