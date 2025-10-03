import { noStoreJson, requireRole } from "@/lib/api";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  // TODO: parse query (?from=&to=&shopId=) and kickoff recompute
  return noStoreJson({ ok: true, accepted: true });
}
