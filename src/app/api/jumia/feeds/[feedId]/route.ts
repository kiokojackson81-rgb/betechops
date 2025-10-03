import { noStoreJson, requireRole } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: { feedId: string } }) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  // TODO: fetch feed status
  return noStoreJson({ id: params.feedId, status: "Pending" });
}
