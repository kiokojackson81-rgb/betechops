import { prisma } from "@/lib/prisma";
import type { TradingPeriod } from "@/lib/tradingPeriod";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";

export const TECHNICAL_POS_PROFIT_COMMISSION_RATE = 0.1;
export const TECHNICAL_PROJECT_COMPLETION_COMMISSION = 2000;

export type TechnicalProjectCommissionSummary = {
  pendingCount: number;
  pendingAmount: number;
  completedCount: number;
  completedAmount: number;
};

export async function getTechnicalProjectCommissionSummary(
  userId: string,
  period: TradingPeriod,
): Promise<TechnicalProjectCommissionSummary> {
  const receipts = await prisma.receipt.findMany({
    where: {
      OR: [
        { data: { path: ["customerType"], equals: "project" } },
        { data: { path: ["projectFlow", "isProject"], equals: true } },
      ],
    },
    select: {
      id: true,
      createdAt: true,
      data: true,
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  let pendingCount = 0;
  let completedCount = 0;

  for (const receipt of receipts) {
    const rawData =
      receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
        ? (receipt.data as Record<string, unknown>)
        : {};
    const flow = readReceiptProjectFlow(rawData.projectFlow);
    if (!flow) continue;
    if (String(flow.handlerStaffId || "").trim() !== userId) continue;

    if (flow.stage === "PROJECT_IN_PROGRESS") {
      pendingCount += 1;
      continue;
    }

    if (flow.stage === "COMPLETED_POSTED") {
      const completedAt = flow.updatedAt ? new Date(flow.updatedAt) : receipt.createdAt;
      if (
        Number.isFinite(completedAt.getTime()) &&
        completedAt >= period.start &&
        completedAt <= period.end
      ) {
        completedCount += 1;
      }
    }
  }

  return {
    pendingCount,
    pendingAmount: pendingCount * TECHNICAL_PROJECT_COMPLETION_COMMISSION,
    completedCount,
    completedAmount: completedCount * TECHNICAL_PROJECT_COMPLETION_COMMISSION,
  };
}
