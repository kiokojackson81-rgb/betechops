import { noStoreJson, requireRole } from "@/lib/api";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;
  // TODO: resolve case, create ReturnAdjustment and commission impact
  return noStoreJson({ ok: true, id: params.id });
}
