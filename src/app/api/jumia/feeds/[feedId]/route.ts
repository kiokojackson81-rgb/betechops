import type { NextRequest } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";

export async function GET(_req: NextRequest, context: { params: Promise<{ feedId: string }> }) {
  const { feedId } = await context.params;
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  // TODO: fetch feed status
  return noStoreJson({ id: feedId, status: "Pending" });
}
