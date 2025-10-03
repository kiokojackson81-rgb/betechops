import type { NextRequest } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;
  // TODO: call Jumia VC to pack and queue labels
  return noStoreJson({ ok: true, id });
}
