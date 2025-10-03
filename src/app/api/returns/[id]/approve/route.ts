import { noStoreJson, requireRole } from "@/lib/api";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  // TODO: transition requested -> approved
  return noStoreJson({ ok: true, id: params.id });
}
