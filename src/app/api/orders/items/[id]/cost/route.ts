import { noStoreJson, requireRole } from "@/lib/api";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  // TODO: set OrderCost override for params.id
  return noStoreJson({ ok: true, id: params.id, accepted: true });
}
