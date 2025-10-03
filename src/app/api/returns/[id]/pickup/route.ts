import { noStoreJson, requireRole } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  // TODO: create ReturnPickup and transition approved -> pickup_scheduled
  return noStoreJson({ ok: true, id: params.id });
}
