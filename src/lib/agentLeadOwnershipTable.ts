import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

let cached: Promise<boolean> | null = null;

export async function isAgentLeadOwnershipTableAvailable(): Promise<boolean> {
  if (cached) return cached;

  cached = (async () => {
    try {
      const rows = await prisma.$queryRaw<{ name: string | null }[]>(
        Prisma.sql`select to_regclass('public."AgentLeadOwnership"')::text as name`,
      );
      return Boolean(rows?.[0]?.name);
    } catch {
      return false;
    }
  })();

  return cached;
}
