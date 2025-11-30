import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { getTradingPeriodFor, getRecentTradingPeriods } from "@/lib/tradingPeriod";
import { z } from "zod";

const BodySchema = z.object({ userId: z.string(), tradingPeriodKey: z.string().optional() });

export async function POST(req: Request) {
  const authz = await requireRole("ADMIN");
  if (!authz.ok) return authz.res;

  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(body);
  } catch (err: any) {
    return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 });
  }

  const { userId, tradingPeriodKey } = parsed;

  try {
    const period = tradingPeriodKey
      ? getRecentTradingPeriods(12).find((p) => p.key === tradingPeriodKey) || getTradingPeriodFor(new Date())
      : getTradingPeriodFor(new Date());

    // Find entries for this attendant in the period
    const entries = await prisma.marketingDailyEntry.findMany({
      where: {
        submittedById: userId,
        date: { gte: period.start, lte: period.end },
      },
      include: { receipts: { include: { items: true } } },
    });

    if (!entries.length) return NextResponse.json({ wiped: 0, entries: [] });

    // Create a batch id for linking logs
    const batchId = `wipe_batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const wipedIds: string[] = [];

    for (const e of entries) {
      // delete items & receipts
      await prisma.marketingReceiptItem.deleteMany({ where: { receipt: { dailyEntryId: e.id } } });
      await prisma.marketingReceipt.deleteMany({ where: { dailyEntryId: e.id } });
      await prisma.marketingDailyEntry.update({ where: { id: e.id }, data: { totalSales: 0, totalProfit: 0 } });

      // Audit log per entry
      try {
        await prisma.actionLog.create({
          data: {
            actorId: (req.headers.get('x-user-id') as string) || '',
            entity: 'MarketingDailyEntry',
            entityId: e.id,
            action: 'WIPE_RECEIPTS',
            before: e as any,
            after: { batchId, requestBy: req.headers.get('x-user-email') || '' } as any,
          },
        });
      } catch (logErr) {
        console.warn('failed to write actionLog for marketing wipe', logErr);
      }
      wipedIds.push(e.id);
    }

    return NextResponse.json({ wiped: wipedIds.length, entries: wipedIds, batchId });
  } catch (err: any) {
    console.error('wipe-by-attendant failed', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
