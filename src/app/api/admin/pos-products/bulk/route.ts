import { noStoreJson, requireRoleOrBrendah, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bulkSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(500),
  action: z.enum(["activate", "archive", "delete"]),
});

export async function POST(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const ids = Array.from(new Set(parsed.data.ids));
  const action = parsed.data.action;

  if (action === "activate" || action === "archive") {
    const isActive = action === "activate";
    const existing = await prisma.product.findMany({ where: { id: { in: ids } } });
    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { isActive },
    });

    if (actorId && existing.length) {
      await prisma.actionLog.createMany({
        data: existing.map((product) => ({
          actorId,
          entity: "Product",
          entityId: product.id,
          action: isActive ? "POS_PRODUCT_BULK_ACTIVATE" : "POS_PRODUCT_BULK_ARCHIVE",
          before: product,
          after: { ...product, isActive },
        })),
      });
    }

    return noStoreJson({
      ok: true,
      updatedCount: Number(result.count ?? 0),
      message: isActive
        ? `${Number(result.count ?? 0)} product${Number(result.count ?? 0) === 1 ? "" : "s"} activated`
        : `${Number(result.count ?? 0)} product${Number(result.count ?? 0) === 1 ? "" : "s"} archived`,
    });
  }

  const products = await prisma.product.findMany({ where: { id: { in: ids } } });
  const orderItemCounts = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { in: ids } },
    _count: { _all: true },
  });
  const linkedCounts = new Map(orderItemCounts.map((row) => [row.productId, Number(row._count._all ?? 0)]));

  let deletedCount = 0;
  let archivedCount = 0;

  for (const product of products) {
    const linkedOrderItems = linkedCounts.get(product.id) ?? 0;
    if (linkedOrderItems > 0) {
      if (product.isActive) {
        await prisma.product.update({
          where: { id: product.id },
          data: { isActive: false },
        });
      }
      archivedCount += 1;
      if (actorId) {
        await prisma.actionLog.create({
          data: {
            actorId,
            entity: "Product",
            entityId: product.id,
            action: "POS_PRODUCT_ARCHIVE",
            before: product,
            after: { ...product, isActive: false },
          },
        });
      }
      continue;
    }

    await prisma.product.delete({ where: { id: product.id } });
    deletedCount += 1;
    if (actorId) {
      await prisma.actionLog.create({
        data: {
          actorId,
          entity: "Product",
          entityId: product.id,
          action: "POS_PRODUCT_DELETE",
          before: product,
        },
      });
    }
  }

  const summaryParts: string[] = [];
  if (deletedCount > 0) summaryParts.push(`${deletedCount} deleted`);
  if (archivedCount > 0) summaryParts.push(`${archivedCount} archived`);

  return noStoreJson({
    ok: true,
    deletedCount,
    archivedCount,
    message: summaryParts.length ? `Bulk catalog cleanup complete: ${summaryParts.join(", ")}` : "No products changed",
  });
}
