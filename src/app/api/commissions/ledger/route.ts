import { noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const schema = z.object({
    shopId: z.string().optional(),
    staffId: z.string().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    status: z.enum(["pending", "approved", "reversed"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    size: z.coerce.number().int().min(1).max(200).default(50),
  });
  const parsed = schema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  const { shopId, staffId, from, to, status, page, size } = parsed.data;

  const where: any = {};
  if (status) where.status = status;
  if (staffId) where.staffId = staffId;
  if (from || to) where.createdAt = { gte: from, lte: to };
  if (shopId) where.orderItem = { order: { shopId } };

  const [items, total] = await Promise.all([
    (prisma as any).commissionEarning.findMany({
      where,
      include: { orderItem: { include: { order: true, product: true } }, staff: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * size,
      take: size,
    }),
    (prisma as any).commissionEarning.count({ where }),
  ]);

  return noStoreJson({ items, page, size, total });
}
