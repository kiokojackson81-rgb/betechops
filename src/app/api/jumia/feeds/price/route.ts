import { noStoreJson, requireRole } from "@/lib/api";

export async function POST() {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  // TODO: submit price feed
  return noStoreJson({ ok: true, accepted: true });
}
