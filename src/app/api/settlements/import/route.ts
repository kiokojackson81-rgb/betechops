import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recomputeProfit } from "@/lib/profitRecompute";
import { z } from "zod";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const Row = z.object({
    shopId: z.string(),
    orderId: z.string().optional().nullable(),
    orderItemId: z.string().optional().nullable(),
    kind: z.enum(["item_price", "commission", "shipping_fee", "refund", "penalty"]).or(z.string()),
    amount: z.number(),
    ref: z.string().optional().nullable(),
    postedAt: z.string(),
  });
  const body = await req.json().catch(() => []);
  const rowsParse = z.array(Row).safeParse(body);
  if (!rowsParse.success || rowsParse.data.length === 0) return noStoreJson({ error: "Invalid rows" }, { status: 400 });
  const rows = rowsParse.data;
  const actorId = await getActorId();
  let inserted = 0;
  let minAt: Date | null = null;
  let maxAt: Date | null = null;
  const shops = new Set<string>();
  for (const r of rows) {
    shops.add(r.shopId);
    const postedAt = new Date(r.postedAt);
    if (!minAt || postedAt < minAt) minAt = postedAt;
    if (!maxAt || postedAt > maxAt) maxAt = postedAt;
    const row = await (prisma as any).settlementRow.create({
      data: {
        shopId: r.shopId,
        orderId: r.orderId || null,
        orderItemId: r.orderItemId || null,
        kind: String(r.kind),
        amount: Number(r.amount),
        ref: r.ref || null,
        postedAt,
        raw: r,
      },
    });
    inserted++;
    if (actorId) await (prisma as any).actionLog.create({ data: { actorId, entity: "SettlementRow", entityId: row.id, action: "IMPORT", before: null, after: row } });
  }
  // Trigger recompute per shop for affected window
  const from = minAt || new Date();
  const to = maxAt || new Date();
  const results: Record<string, number> = {};
  for (const shopId of shops) {
    const { snapshots } = await recomputeProfit({ from, to, shopId, actorId });
    results[shopId] = snapshots;
  }
  return noStoreJson({ ok: true, inserted, recompute: { from, to, results } });
}
