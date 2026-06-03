import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function formatLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTradingPeriodFor(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear: number;
  let startMonth: number;
  let endYear: number;
  let endMonth: number;

  if (day >= 25) {
    startYear = year;
    startMonth = month;
    const next = new Date(year, month + 1, 1);
    endYear = next.getFullYear();
    endMonth = next.getMonth();
  } else {
    const prev = new Date(year, month - 1, 1);
    startYear = prev.getFullYear();
    startMonth = prev.getMonth();
    endYear = year;
    endMonth = month;
  }

  const start = new Date(startYear, startMonth, 25, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth, 24, 23, 59, 59, 999);
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}_${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  const label = `${formatLabel(start)} – ${formatLabel(end)}`;

  return { start, end, key, label };
}

type ExistingCommissionRow = {
  id: string;
  orderItemId: string;
  status: string;
  amount: unknown;
  calcDetail: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveNextStatus(args: {
  existingRows: ExistingCommissionRow[];
  requiresAdminApproval: boolean;
  isLayaway: boolean;
  isLayawayComplete: boolean;
}) {
  const existingStatuses = args.existingRows.map((row) => String(row.status || "").toUpperCase());
  if (existingStatuses.includes("APPROVED")) return "APPROVED";
  if (existingStatuses.includes("RELEASED")) return "RELEASED";
  if (existingStatuses.includes("REJECTED")) return "REJECTED";
  if (existingStatuses.includes("CANCELLED")) return "CANCELLED";
  if (args.requiresAdminApproval) return "PENDING_APPROVAL";
  if (args.isLayaway && !args.isLayawayComplete) return "PENDING";
  return "RELEASED";
}

async function main() {
  const period = getTradingPeriodFor(new Date());
  console.log(`[repair] trading period ${period.key} (${period.label})`);

  const receipts = await prisma.receipt.findMany({
    where: {
      createdAt: {
        gte: period.start,
        lte: period.end,
      },
    },
    include: {
      order: {
        include: {
          layawayPlan: true,
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  commissionEnabled: true,
                  commissionAmount: true,
                  commissionRequiresApproval: true,
                },
              },
              commissionEarnings: {
                where: {
                  basis: "product_flat",
                },
                select: {
                  id: true,
                  orderItemId: true,
                  status: true,
                  amount: true,
                  calcDetail: true,
                },
              },
            },
          },
        },
      },
    },
  });

  let receiptsScanned = 0;
  let receiptsTouched = 0;
  let deletedRows = 0;
  let createdRows = 0;

  for (const receipt of receipts) {
    receiptsScanned += 1;
    if (!receipt.order) continue;

    const receiptData = asRecord(receipt.data);
    const podDelivery = asRecord(receiptData?.podDelivery);
    const isPodDelivery =
      String(receiptData?.customerType ?? "").toLowerCase() === "pod" || Boolean(podDelivery);
    const isLayaway = String(receipt.docType || "").toUpperCase() === "LAYAWAY";
    const isLayawayComplete =
      !isLayaway || Boolean(receipt.order.layawayPlan?.isComplete) || toNumber(receipt.order.paidAmount) >= toNumber(receipt.order.totalAmount);

    const targetRows = receipt.order.items
      .map((orderItem) => {
        const product = orderItem.product;
        const unitCommission = toNumber(product?.commissionAmount);
        if (!product?.commissionEnabled || unitCommission <= 0) return null;

        const amount = unitCommission * Math.max(1, Number(orderItem.quantity || 1));
        if (amount <= 0) return null;

        const requiresAdminApproval = isPodDelivery || Boolean(product.commissionRequiresApproval);
        const status = resolveNextStatus({
          existingRows: orderItem.commissionEarnings as ExistingCommissionRow[],
          requiresAdminApproval,
          isLayaway,
          isLayawayComplete,
        });

        return {
          staffId: receipt.order?.attendantId ?? receipt.issuedById ?? null,
          orderItemId: orderItem.id,
          basis: "product_flat",
          qty: orderItem.quantity,
          amount,
          status,
          calcDetail: {
            reason: "pos_product_commission",
            productId: product.id,
            productName: product.name,
            orderNumber: receipt.order?.orderNumber ?? null,
            receiptId: receipt.id,
            requiresApproval: requiresAdminApproval,
            unitCommission,
            customerType: receiptData?.customerType ?? null,
            repairedAt: new Date().toISOString(),
            repairSource: "refresh-current-period-pos-product-commissions",
          },
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => Boolean(row.staffId));

    const existingProductRows = receipt.order.items.flatMap((item) => item.commissionEarnings);
    const shouldTouch =
      targetRows.length > 0 &&
      (existingProductRows.length !== targetRows.length ||
        targetRows.some((row) => {
          const existing = existingProductRows.find((item) => item.orderItemId === row.orderItemId);
          if (!existing) return true;
          return Number(existing.amount ?? 0) !== Number(row.amount) || String(existing.status) !== String(row.status);
        }));

    if (!shouldTouch) continue;

    receiptsTouched += 1;
    const orderItemIds = receipt.order.items.map((item) => item.id);
    const deleted = await prisma.commissionEarning.deleteMany({
      where: {
        orderItemId: { in: orderItemIds },
        basis: "product_flat",
      },
    });
    deletedRows += deleted.count;

    if (targetRows.length > 0) {
      const created = await prisma.commissionEarning.createMany({ data: targetRows as any[] });
      createdRows += created.count;
    }
  }

  console.log(
    JSON.stringify(
      {
        periodKey: period.key,
        receiptsScanned,
        receiptsTouched,
        deletedRows,
        createdRows,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("[repair] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
