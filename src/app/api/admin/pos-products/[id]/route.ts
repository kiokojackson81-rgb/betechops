import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recomputeOrderEconomics } from "@/lib/recomputeOrderEconomics";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  sku: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  lastBuyingPrice: z.coerce.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  commissionEnabled: z.boolean().optional(),
  commissionAmount: z.coerce.number().min(0).nullable().optional(),
  commissionRequiresApproval: z.boolean().optional(),
});

function normalizeSku(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveId(context: ParamsContext) {
  return "params" in context && typeof (context as { params: Promise<{ id: string }> }).params?.then === "function"
    ? (await (context as { params: Promise<{ id: string }> }).params).id
    : (context as { params: { id: string } }).params.id;
}

export async function PATCH(req: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const id = await resolveId(context);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return noStoreJson({ error: "Product not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const data = parsed.data;
  const nextSku = data.sku ? normalizeSku(data.sku) : undefined;
  if (nextSku && nextSku !== existing.sku) {
    const duplicate = await prisma.product.findUnique({ where: { sku: nextSku }, select: { id: true } });
    if (duplicate) return noStoreJson({ error: "SKU already exists" }, { status: 409 });
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      sku: nextSku,
      name: data.name,
      category: data.category,
      sellingPrice: data.sellingPrice,
      lastBuyingPrice: data.lastBuyingPrice,
      isActive: data.isActive,
      commissionEnabled: data.commissionEnabled,
      commissionAmount:
        data.commissionEnabled === false
          ? null
          : data.commissionAmount !== undefined
            ? data.commissionAmount
            : undefined,
      commissionRequiresApproval:
        data.commissionEnabled === false
          ? false
          : data.commissionRequiresApproval,
    },
  });

  const nextBuyingPrice = Number(updated.lastBuyingPrice ?? 0);
  let backfilledItems = 0;
  let recomputedOrders = 0;
  if (Number.isFinite(nextBuyingPrice) && nextBuyingPrice > 0) {
    const itemsMissingCosts = await prisma.orderItem.findMany({
      where: {
        productId: id,
        orderCosts: { none: {} },
      },
      select: {
        id: true,
        orderId: true,
      },
    });

    if (itemsMissingCosts.length > 0) {
      await prisma.orderCost.createMany({
        data: itemsMissingCosts.map((item) => ({
          orderItemId: item.id,
          unitCost: nextBuyingPrice,
          costSource: "product_catalog_sync",
        })),
      });
      backfilledItems = itemsMissingCosts.length;

      const touchedOrderIds = Array.from(new Set(itemsMissingCosts.map((item) => item.orderId).filter(Boolean)));
      for (const orderId of touchedOrderIds) {
        await recomputeOrderEconomics(orderId);
      }
      recomputedOrders = touchedOrderIds.length;
    }
  }

  if (actorId) {
    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "Product",
        entityId: updated.id,
        action: "POS_PRODUCT_UPDATE",
        before: existing,
        after: updated,
      },
    });
  }

  return noStoreJson({
    ok: true,
    item: updated,
    backfill: {
      items: backfilledItems,
      orders: recomputedOrders,
    },
  });
}

export async function DELETE(_: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const id = await resolveId(context);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return noStoreJson({ error: "Product not found" }, { status: 404 });

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const linkedOrderItems = await prisma.orderItem.count({ where: { productId: id } });

  if (linkedOrderItems > 0) {
    const archived =
      existing.isActive
        ? await prisma.product.update({
            where: { id },
            data: { isActive: false },
          })
        : existing;

    if (actorId) {
      await prisma.actionLog.create({
        data: {
          actorId,
          entity: "Product",
          entityId: existing.id,
          action: "POS_PRODUCT_ARCHIVE",
          before: existing,
          after: archived,
        },
      });
    }

    return noStoreJson({
      ok: true,
      archived: true,
      item: archived,
      message: existing.isActive
        ? "Product archived. Historical POS receipts remain unchanged."
        : "Product is already archived. Historical POS receipts remain unchanged.",
    });
  }

  try {
    await prisma.product.delete({
      where: { id },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2014")
    ) {
      return noStoreJson(
        { error: "This product is linked to historical receipts. Archive it instead so receipts remain unchanged." },
        { status: 409 },
      );
    }
    throw error;
  }

  if (actorId) {
    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "Product",
        entityId: existing.id,
        action: "POS_PRODUCT_DELETE",
        before: existing,
      },
    });
  }

  return noStoreJson({ ok: true });
}
