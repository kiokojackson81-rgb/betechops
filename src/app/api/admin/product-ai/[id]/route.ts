import { NextRequest } from "next/server";
import { noStoreJson, requireRoleOrBrendah } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  const job = await (prisma as any).productAiJob.findUnique({
    where: { id },
  });

  if (!job) {
    return noStoreJson({ error: "AI job not found" }, { status: 404 });
  }

  return noStoreJson({ job });
}
