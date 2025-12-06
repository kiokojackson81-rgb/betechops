import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMarketplaceAssignmentsForUser } from "@/lib/onlineOps";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  const { accountIds } = await getMarketplaceAssignmentsForUser(auth.user.id);
  if (!accountIds.length) {
    return NextResponse.json({ returns: [] });
  }

  const returns = await prisma.marketplaceReturn.findMany({
    where: {
      accountId: { in: accountIds },
    },
    include: {
      account: true,
      attachments: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const now = Date.now();
  return NextResponse.json({
    returns: returns.map((entry: any) => ({
      id: entry.id,
      accountName: entry.account.displayName,
      platform: entry.platform,
      orderItemId: entry.orderItemId,
      expectedAmount: Number(entry.expectedAmount ?? 0),
      status: entry.status,
      createdAt: entry.createdAt.toISOString(),
      dueAt: entry.dueAt.toISOString(),
      daysRemaining: Math.ceil((entry.dueAt.getTime() - now) / (1000 * 60 * 60 * 24)),
      notes: entry.notes,
      attachments: entry.attachments.map((att: any) => ({
        id: att.id,
        url: att.url,
        uploadedAt: att.createdAt.toISOString(),
      })),
    })),
  });
}
