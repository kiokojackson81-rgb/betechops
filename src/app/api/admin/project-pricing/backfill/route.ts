import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";
import { syncCompletedProjectReceiptToPricing } from "@/lib/projectPricingSync";

export const dynamic = "force-dynamic";

function parseOptionalDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => ({}));
  const startDate = parseOptionalDate(typeof body?.startDate === "string" ? body.startDate : null);
  const endDate = parseOptionalDate(typeof body?.endDate === "string" ? body.endDate : null);
  const limit = Math.min(500, Math.max(1, Number(body?.limit ?? 200)));
  const receiptIds = Array.isArray(body?.receiptIds)
    ? body.receiptIds.map((value: unknown) => String(value ?? "").trim()).filter(Boolean)
    : [];

  const where: Prisma.ReceiptWhereInput = {
    AND: [
      {
        data: {
          path: ["projectFlow"],
          not: Prisma.JsonNull,
        },
      },
      ...(receiptIds.length ? [{ id: { in: receiptIds } }] : []),
      ...(startDate || endDate
        ? [{
            updatedAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }]
        : []),
    ],
  };

  const receipts = await prisma.receipt.findMany({
    where,
    include: {
      order: {
        select: {
          orderNumber: true,
          totalAmount: true,
          attendantId: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const candidates = receipts
    .map((receipt) => ({
      receipt,
      flow: readReceiptProjectFlow(
        receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
          ? (receipt.data as Record<string, unknown>).projectFlow
          : null,
      ),
    }))
    .filter((entry) => entry.flow?.stage === "COMPLETED_POSTED");

  const results: Array<{
    receiptId: string;
    receiptNumber: string | null;
    status: "synced" | "skipped" | "error";
    detail: string;
  }> = [];

  for (const candidate of candidates) {
    try {
      const syncResult = await prisma.$transaction((tx) =>
        syncCompletedProjectReceiptToPricing(tx, candidate.receipt, candidate.flow!),
      );
      if (!syncResult.ok) {
        results.push({
          receiptId: candidate.receipt.id,
          receiptNumber: candidate.receipt.order?.orderNumber ?? candidate.receipt.receiptNumber ?? null,
          status: "skipped",
          detail: syncResult.reason,
        });
        continue;
      }
      results.push({
        receiptId: candidate.receipt.id,
        receiptNumber: syncResult.receiptNumber ?? candidate.receipt.order?.orderNumber ?? candidate.receipt.receiptNumber ?? null,
        status: "synced",
        detail: `${syncResult.action} support receipt on ${syncResult.completionDate}`,
      });
    } catch (error) {
      results.push({
        receiptId: candidate.receipt.id,
        receiptNumber: candidate.receipt.order?.orderNumber ?? candidate.receipt.receiptNumber ?? null,
        status: "error",
        detail: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: receipts.length,
    candidates: candidates.length,
    synced: results.filter((item) => item.status === "synced").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    errors: results.filter((item) => item.status === "error").length,
    results,
  });
}
