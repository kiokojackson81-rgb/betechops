import { noStoreJson, requireRoleOrBrendah, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
});

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveId(context: ParamsContext) {
  return "params" in context && typeof (context as { params: Promise<{ id: string }> }).params?.then === "function"
    ? (await (context as { params: Promise<{ id: string }> }).params).id
    : (context as { params: { id: string } }).params.id;
}

export async function PATCH(req: Request, context: ParamsContext) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const id = await resolveId(context);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || existing.category !== "pos") {
    return noStoreJson({ error: "Product not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? (await getActorId());
  const updated = await prisma.product.update({
    where: { id },
    data: {
      name: parsed.data.name,
      sellingPrice: parsed.data.sellingPrice,
    },
  });

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

  return noStoreJson({ ok: true, item: updated });
}

export async function DELETE(_: Request, context: ParamsContext) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const id = await resolveId(context);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing || existing.category !== "pos") {
    return noStoreJson({ error: "Product not found" }, { status: 404 });
  }

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
