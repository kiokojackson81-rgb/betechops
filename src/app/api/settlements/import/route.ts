import { noStoreJson, requireRole, getActorId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const rows = await req.json().catch(() => [] as any[]);
  if (!Array.isArray(rows) || rows.length === 0) return noStoreJson({ error: "body must be an array of settlement rows" }, { status: 400 });
  const actorId = await getActorId();
  let inserted = 0;
  for (const r of rows) {
    if (!r.shopId || !r.kind || r.amount == null || !r.postedAt) continue;
    const row = await (prisma as any).settlementRow.create({
      data: {
        shopId: r.shopId,
        orderId: r.orderId || null,
        orderItemId: r.orderItemId || null,
        kind: String(r.kind),
        amount: Number(r.amount),
        ref: r.ref || null,
        postedAt: new Date(r.postedAt),
        raw: r,
      },
    });
    inserted++;
    if (actorId) await (prisma as any).actionLog.create({ data: { actorId, entity: "SettlementRow", entityId: row.id, action: "IMPORT", before: null, after: row } });
  }
  // TODO: trigger profit recompute for the affected period/shopId(s)
  return noStoreJson({ ok: true, inserted });
}
