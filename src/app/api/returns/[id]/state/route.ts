import { noStoreJson, requireRole } from "@/lib/api";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;
  // TODO: guarded transitions using returns.ts
  return noStoreJson({ ok: true, id: params.id });
}
