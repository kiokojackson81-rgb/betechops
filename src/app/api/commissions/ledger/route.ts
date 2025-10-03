import { noStoreJson, requireRole } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  // TODO: query CommissionEarning by filters
  return noStoreJson({ items: [] });
}
