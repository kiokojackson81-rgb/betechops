import { noStoreJson, requireRole } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;
  // TODO: mark order ready to ship
  return noStoreJson({ ok: true, id: params.id });
}
