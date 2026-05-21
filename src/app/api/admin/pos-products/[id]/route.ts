import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getProductTableCapabilities } from "@/lib/productTableCapabilities";
import { recomputeOrderEconomics } from "@/lib/recomputeOrderEconomics";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MAX_SKU_LENGTH = 80;

const updateSchema = z.object({
  sku: z.string().trim().min(1).max(255).optional(),
  name: z.string().trim().min(1).max(255).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  lastBuyingPrice: z.coerce.number().min(0).nullable().optional(),
  defaultWarranty: z.string().trim().max(50).nullable().optional(),
  variableCost: z.boolean().optional(),
  isActive: z.boolean().optional(),
  commissionEnabled: z.boolean().optional(),
  commissionAmount: z.coerce.number().min(0).nullable().optional(),
  commissionRequiresApproval: z.boolean().optional(),
  showInShop: z.boolean().optional(),
  shopCategory: z.string().trim().max(120).nullable().optional(),
  shopShortDescription: z.string().trim().max(1000).nullable().optional(),
  shopWarranty: z.string().trim().max(255).nullable().optional(),
  shopSpecs: z.string().trim().max(2000).nullable().optional(),
  shopImageUrl: z.string().trim().max(500).nullable().optional(),
  shopBrand: z.string().trim().max(120).nullable().optional(),
});

function normalizeSku(input: string) {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SKU_LENGTH);
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveId(context: ParamsContext) {
  return "params" in context && typeof (context as { params: Promise<{ id: string }> }).params?.then === "function"
    ? (await (context as { params: Promise<{ id: string }> }).params).id
    : (context as { params: { id: string } }).params.id;
}

async function getExistingProductRecord(id: string, capabilities: Awaited<ReturnType<typeof getProductTableCapabilities>>) {
  const rows = capabilities.schemaMode === "modern"
    ? await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `
          SELECT
            "id",
            "sku",
            "name",
            COALESCE("category", 'pos') AS "category",
            COALESCE("sellingPrice", 0) AS "sellingPrice",
            "lastBuyingPrice",
            "defaultWarranty",
            COALESCE("variableCost", false) AS "variableCost",
            COALESCE("isActive", true) AS "isActive",
            COALESCE("commissionEnabled", false) AS "commissionEnabled",
            "commissionAmount",
            COALESCE("commissionRequiresApproval", false) AS "commissionRequiresApproval",
            ${capabilities.showInShop ? `COALESCE("showInShop", false)` : `NULL::boolean`} AS "showInShop",
            ${capabilities.shopCategory ? `"shopCategory"` : `NULL::text`} AS "shopCategory",
            ${capabilities.shopShortDescription ? `"shopShortDescription"` : `NULL::text`} AS "shopShortDescription",
            ${capabilities.shopWarranty ? `"shopWarranty"` : `NULL::text`} AS "shopWarranty",
            ${capabilities.shopSpecs ? `"shopSpecs"` : `NULL::text`} AS "shopSpecs",
            ${capabilities.shopImageUrl ? `"shopImageUrl"` : `NULL::text`} AS "shopImageUrl",
            ${capabilities.shopBrand ? `"shopBrand"` : `NULL::text`} AS "shopBrand"
          FROM "Product"
          WHERE "id" = $1
          LIMIT 1
        `,
        id,
      )
    : await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `
          SELECT
            "id",
            COALESCE("key", "id") AS "sku",
            "name",
            COALESCE("unit", 'pos') AS "category",
            COALESCE("sellPrice", 0) AS "sellingPrice",
            NULL::double precision AS "lastBuyingPrice",
            NULL::text AS "defaultWarranty",
            false AS "variableCost",
            COALESCE("active", true) AS "isActive",
            false AS "commissionEnabled",
            NULL::numeric AS "commissionAmount",
            false AS "commissionRequiresApproval",
            ${capabilities.showInShop ? `COALESCE("showInShop", false)` : `NULL::boolean`} AS "showInShop",
            ${capabilities.shopCategory ? `"shopCategory"` : `NULL::text`} AS "shopCategory",
            ${capabilities.shopShortDescription ? `"shopShortDescription"` : `NULL::text`} AS "shopShortDescription",
            ${capabilities.shopWarranty ? `"shopWarranty"` : `NULL::text`} AS "shopWarranty",
            ${capabilities.shopSpecs ? `"shopSpecs"` : `NULL::text`} AS "shopSpecs",
            ${capabilities.shopImageUrl ? `"shopImageUrl"` : `NULL::text`} AS "shopImageUrl",
            ${capabilities.shopBrand ? `"shopBrand"` : `NULL::text`} AS "shopBrand"
          FROM "Product"
          WHERE "id" = $1
          LIMIT 1
        `,
        id,
      );

  return rows[0] ?? null;
}

async function findDuplicateSku(id: string, sku: string, capabilities: Awaited<ReturnType<typeof getProductTableCapabilities>>) {
  const rows = capabilities.schemaMode === "modern"
    ? await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "Product" WHERE "sku" = $1 AND "id" <> $2 LIMIT 1`,
        sku,
        id,
      )
    : await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "Product" WHERE COALESCE("key", '') = $1 AND "id" <> $2 LIMIT 1`,
        sku,
        id,
      );

  return rows[0] ?? null;
}

export async function PATCH(req: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const capabilities = await getProductTableCapabilities(prisma);
  const id = await resolveId(context);
  const existing = await getExistingProductRecord(id, capabilities);
  if (!existing) return noStoreJson({ error: "Product not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const data = parsed.data;
  const nextVariableCost = data.variableCost ?? Boolean(existing.variableCost);
  const nextLastBuyingPrice = data.lastBuyingPrice !== undefined ? data.lastBuyingPrice : Number(existing.lastBuyingPrice ?? 0) || null;
  if (capabilities.schemaMode === "modern" && !nextVariableCost && !(Number(nextLastBuyingPrice ?? 0) > 0)) {
    return noStoreJson(
      { error: { fieldErrors: { lastBuyingPrice: ["Buying price is required for fixed-cost products"] } } },
      { status: 400 },
    );
  }

  const nextSku = data.sku ? normalizeSku(data.sku) : undefined;
  if (nextSku) {
    const duplicate = await findDuplicateSku(id, nextSku, capabilities);
    if (duplicate) return noStoreJson({ error: "SKU already exists" }, { status: 409 });
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  const pushSet = (column: string, value: unknown) => {
    values.push(value);
    setClauses.push(`"${column}" = $${values.length}`);
  };

  if (capabilities.schemaMode === "modern") {
    if (nextSku !== undefined) pushSet("sku", nextSku);
    if (data.name !== undefined) pushSet("name", data.name);
    if (data.category !== undefined) pushSet("category", data.category);
    if (data.sellingPrice !== undefined) pushSet("sellingPrice", data.sellingPrice);
    if (data.lastBuyingPrice !== undefined || data.variableCost !== undefined) {
      pushSet("lastBuyingPrice", nextVariableCost ? null : nextLastBuyingPrice);
    }
    if (data.defaultWarranty !== undefined) pushSet("defaultWarranty", normalizeOptionalText(data.defaultWarranty));
    if (data.variableCost !== undefined) pushSet("variableCost", data.variableCost);
    if (data.isActive !== undefined) pushSet("isActive", data.isActive);
    if (data.commissionEnabled !== undefined) pushSet("commissionEnabled", data.commissionEnabled);
    if (data.commissionAmount !== undefined || data.commissionEnabled === false) {
      pushSet("commissionAmount", data.commissionEnabled === false ? null : data.commissionAmount ?? null);
    }
    if (data.commissionRequiresApproval !== undefined || data.commissionEnabled === false) {
      pushSet("commissionRequiresApproval", data.commissionEnabled === false ? false : Boolean(data.commissionRequiresApproval));
    }
  } else {
    if (nextSku !== undefined) pushSet("key", nextSku);
    if (data.name !== undefined) pushSet("name", data.name);
    if (data.category !== undefined) pushSet("unit", data.category);
    if (data.sellingPrice !== undefined) pushSet("sellPrice", data.sellingPrice);
    if (data.isActive !== undefined) pushSet("active", data.isActive);
  }

  if (capabilities.showInShop && data.showInShop !== undefined) pushSet("showInShop", data.showInShop);
  if (capabilities.shopCategory && data.shopCategory !== undefined) pushSet("shopCategory", normalizeOptionalText(data.shopCategory));
  if (capabilities.shopShortDescription && data.shopShortDescription !== undefined) pushSet("shopShortDescription", normalizeOptionalText(data.shopShortDescription));
  if (capabilities.shopWarranty && data.shopWarranty !== undefined) pushSet("shopWarranty", normalizeOptionalText(data.shopWarranty));
  if (capabilities.shopSpecs && data.shopSpecs !== undefined) pushSet("shopSpecs", normalizeOptionalText(data.shopSpecs));
  if (capabilities.shopImageUrl && data.shopImageUrl !== undefined) pushSet("shopImageUrl", normalizeOptionalText(data.shopImageUrl));
  if (capabilities.shopBrand && data.shopBrand !== undefined) pushSet("shopBrand", normalizeOptionalText(data.shopBrand));

  if (!setClauses.length) {
    return noStoreJson({ ok: true, item: existing, backfill: { items: 0, orders: 0 } });
  }

  values.push(id);
  const updated = (await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `UPDATE "Product" SET ${setClauses.join(", ")} WHERE "id" = $${values.length} RETURNING *`,
    ...values,
  ))[0];

  let backfilledItems = 0;
  let recomputedOrders = 0;
  if (capabilities.schemaMode === "modern") {
    const nextBuyingPrice = Number(updated.lastBuyingPrice ?? 0);
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
  }

  if (actorId) {
    await prisma.actionLog.create({
      data: {
        actorId,
        entity: "Product",
        entityId: String(updated.id),
        action: "POS_PRODUCT_UPDATE",
        before: existing as Prisma.InputJsonValue,
        after: updated as Prisma.InputJsonValue,
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

  const capabilities = await getProductTableCapabilities(prisma);
  const id = await resolveId(context);
  const existing = await getExistingProductRecord(id, capabilities);
  if (!existing) return noStoreJson({ error: "Product not found" }, { status: 404 });

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const linkedOrderItems = await prisma.orderItem.count({ where: { productId: id } });

  if (linkedOrderItems > 0) {
    const archived =
      capabilities.schemaMode === "modern"
        ? existing.isActive
          ? await prisma.product.update({
              where: { id },
              data: { isActive: false },
            })
          : existing
        : (await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
            `UPDATE "Product" SET "active" = FALSE WHERE "id" = $1 RETURNING *`,
            id,
          ))[0];

    if (actorId) {
      await prisma.actionLog.create({
        data: {
          actorId,
          entity: "Product",
          entityId: String(existing.id),
          action: "POS_PRODUCT_ARCHIVE",
          before: existing as Prisma.InputJsonValue,
          after: archived as Prisma.InputJsonValue,
        },
      });
    }

    return noStoreJson({
      ok: true,
      archived: true,
      item: archived,
      message: capabilities.schemaMode === "modern" && existing.isActive
        ? "Product archived. Historical POS receipts remain unchanged."
        : "Product is already archived. Historical POS receipts remain unchanged.",
    });
  }

  try {
    if (capabilities.schemaMode === "modern") {
      await prisma.product.delete({
        where: { id },
      });
    } else {
      await prisma.$executeRawUnsafe(`DELETE FROM "Product" WHERE "id" = $1`, id);
    }
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
          entityId: String(existing.id),
          action: "POS_PRODUCT_DELETE",
          before: existing as Prisma.InputJsonValue,
      },
    });
  }

  return noStoreJson({ ok: true });
}
