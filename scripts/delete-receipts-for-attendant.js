const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  try {
    const attendantEmail = process.env.ATTENDANT_EMAIL || process.argv[2];
    const attendantIdArg = process.env.ATTENDANT_ID || process.argv[3];
    const confirm = process.env.CONFIRM === '1' || process.env.CONFIRM === 'true';
    const sumExpect = process.env.SUM_EXPECT ? Number(process.env.SUM_EXPECT) : undefined;
    const countExpect = process.env.COUNT_EXPECT ? Number(process.env.COUNT_EXPECT) : undefined;

    if (!attendantEmail && !attendantIdArg) {
      console.error('Provide ATTENDANT_EMAIL or ATTENDANT_ID (env or argv)');
      process.exit(2);
    }

    let attendant = null;
    if (attendantEmail) {
      attendant = await p.user.findUnique({ where: { email: attendantEmail } });
      if (!attendant) {
        console.error('No user found for email:', attendantEmail);
        process.exit(3);
      }
    }
    const attendantId = (attendant && attendant.id) || attendantIdArg;

    console.log('Finding receipts (pos, marketing, support) for attendantId=', attendantId);

    // POS receipts where order.attendantId OR issuedById OR data.attendantId
    const posReceipts = await p.receipt.findMany({
      where: {
        OR: [
          { order: { attendantId } },
          { issuedById: attendantId },
          { data: { path: ['attendantId'], equals: attendantId } },
        ],
      },
      include: { order: { include: { items: true, layawayPlan: true } }, issuedBy: true },
      orderBy: { generatedAt: 'desc' },
    });

    const marketingReceipts = await p.marketingReceipt.findMany({
      where: { dailyEntry: { submittedById: attendantId } },
      include: { items: true, dailyEntry: { include: { submittedBy: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const supportReceipts = await p.supportReceipt.findMany({
      where: { dailyEntry: { submittedById: attendantId } },
      include: { items: true, dailyEntry: { include: { submittedBy: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (!posReceipts.length && !marketingReceipts.length && !supportReceipts.length) {
      console.log('No receipts found for attendant (pos/marketing/support).');
      process.exit(0);
    }

    const posRows = posReceipts.map((r) => {
      const total = (r.totals && typeof r.totals.total === 'number') ? r.totals.total : (r.order ? Number(r.order.totalAmount || 0) : 0);
      return { source: 'pos', id: r.id, orderNumber: r.order?.orderNumber ?? null, total, generatedAt: r.generatedAt, issuedBy: r.issuedBy?.email ?? null };
    });
    const mRows = marketingReceipts.map((r) => ({ source: 'marketing', id: `marketing-${r.id}`, rawId: r.id, dailyEntryId: r.dailyEntryId ?? (r.dailyEntry ? r.dailyEntry.id : null), orderNumber: r.receiptNumber ?? null, total: Number(r.sellingTotal || 0), generatedAt: r.createdAt, issuedBy: r.dailyEntry?.submittedBy?.email ?? null }));
    const sRows = supportReceipts.map((r) => ({ source: 'support', id: `support-${r.id}`, rawId: r.id, dailyEntryId: r.dailyEntryId ?? (r.dailyEntry ? r.dailyEntry.id : null), orderNumber: r.receiptNumber ?? null, total: Number(r.sellingTotal || 0), generatedAt: r.createdAt, issuedBy: r.dailyEntry?.submittedBy?.email ?? null }));

    const rows = [...posRows, ...mRows, ...sRows];
    console.log('Found', rows.length, 'receipt(s):');
    rows.forEach((r) => console.log(JSON.stringify(r)));

    const sum = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    console.log('SUM total:', sum);

    if (countExpect !== undefined || sumExpect !== undefined) {
      console.log('Expect count=', countExpect, 'expect sum=', sumExpect);
      if (countExpect !== undefined && countExpect !== rows.length) {
        console.warn('COUNT mismatch - aborting deletion unless CONFIRM=1 explicitly set.');
      }
      if (sumExpect !== undefined && sumExpect !== sum) {
        console.warn('SUM mismatch - aborting deletion unless CONFIRM=1 explicitly set.');
      }
    }

    // Allow targeted deletion via RECEIPT_IDS (comma-separated list of printed ids e.g. "marketing-cmjab32f3...,marketing-cmjab2i0u...")
    const toDeleteArg = process.env.RECEIPT_IDS || process.env.DELETE_IDS || null;
    if (!confirm) {
      console.log('\nDry-run mode. To delete these receipts, re-run with env CONFIRM=1 and optionally RECEIPT_IDS to restrict which to delete.');
      process.exit(0);
    }

    const printableIds = rows.map(r => r.id);
    const toDelete = toDeleteArg ? String(toDeleteArg).split(',').map(s=>s.trim()).filter(Boolean) : printableIds;
    console.log('Will delete the following ids:', toDelete);

    console.log('\nConfirm=1 detected. Deleting selected receipts in a single transaction...');
    await p.$transaction(async (tx) => {
      const marketingEntryIdsToRecalc = new Set();
      const supportEntryIdsToRecalc = new Set();

      // handle marketing/support by raw id (delete items + receipt), track affected dailyEntry ids
      for (const r of rows) {
        if (!toDelete.includes(r.id)) continue;
        if (r.source === 'marketing') {
          const rawId = r.rawId;
          const mr = await tx.marketingReceipt.findUnique({ where: { id: rawId } });
          if (!mr) {
            console.warn('Marketing receipt not found, skipping', rawId);
            continue;
          }
          if (mr.dailyEntryId) marketingEntryIdsToRecalc.add(mr.dailyEntryId);
          await tx.marketingReceiptItem.deleteMany({ where: { receiptId: rawId } });
          await tx.marketingReceipt.delete({ where: { id: rawId } });
          console.log('Deleted marketing receipt', r.id, rawId);
          continue;
        }
        if (r.source === 'support') {
          const rawId = r.rawId;
          const sr = await tx.supportReceipt.findUnique({ where: { id: rawId } });
          if (!sr) {
            console.warn('Support receipt not found, skipping', rawId);
            continue;
          }
          if (sr.dailyEntryId) supportEntryIdsToRecalc.add(sr.dailyEntryId);
          await tx.supportReceiptItem.deleteMany({ where: { receiptId: rawId } });
          await tx.supportReceipt.delete({ where: { id: rawId } });
          console.log('Deleted support receipt', r.id, rawId);
          continue;
        }
        // pos receipts: find order and cascade delete (similar to API route)
        if (r.source === 'pos') {
          const receipt = await tx.receipt.findUnique({ where: { id: r.id }, include: { order: { include: { items: true, layawayPlan: true } } } });
          if (!receipt) {
            console.warn('POS receipt not found, skipping', r.id);
            continue;
          }
          const order = receipt.order;
          if (!order) {
            console.warn('POS receipt has no order, skipping', r.id);
            continue;
          }
          const orderId = order.id;
          if (order.orderNumber) {
            // cleanup marketing/support entries for this orderNumber
            const norm = order.orderNumber;
            // delete any marketing receipts that match this orderNumber
            const mToDel = await tx.marketingReceipt.findMany({ where: { receiptNumber: norm }, select: { id: true, dailyEntryId: true } });
            for (const md of mToDel) {
              if (md.dailyEntryId) marketingEntryIdsToRecalc.add(md.dailyEntryId);
              await tx.marketingReceiptItem.deleteMany({ where: { receiptId: md.id } });
              await tx.marketingReceipt.delete({ where: { id: md.id } });
            }
            const sToDel = await tx.supportReceipt.findMany({ where: { receiptNumber: norm }, select: { id: true, dailyEntryId: true } });
            for (const sd of sToDel) {
              if (sd.dailyEntryId) supportEntryIdsToRecalc.add(sd.dailyEntryId);
              await tx.supportReceiptItem.deleteMany({ where: { receiptId: sd.id } });
              await tx.supportReceipt.delete({ where: { id: sd.id } });
            }
          }
          const itemIds = (order.items || []).map(it => it.id);
          if (itemIds.length) await tx.commissionEarning.deleteMany({ where: { orderItemId: { in: itemIds } } });
          await tx.commissionRecord.deleteMany({ where: { orderId } });
          await tx.returnAdjustment.deleteMany({ where: { returnCase: { orderId } } });
          await tx.returnCase.deleteMany({ where: { orderId } });
          await tx.settlementRow.deleteMany({ where: { orderId } });
          if (order.layawayPlan) { try { await tx.layawayPlan.delete({ where: { id: order.layawayPlan.id } }); } catch(e) {} }
          await tx.orderItem.deleteMany({ where: { orderId } });
          await tx.receipt.delete({ where: { id: r.id } });
          await tx.order.delete({ where: { id: orderId } });
          try { await tx.actionLog.create({ data: { actorId: 'operator-script', entity: 'Receipt', entityId: r.id, action: 'DELETE', before: receipt, after: null } }); } catch (e) {}
          console.log('Deleted pos receipt', r.id, 'order', orderId);
        }
      }

      // Recalc marketing entries totals
      for (const entryId of marketingEntryIdsToRecalc) {
        const remaining = await tx.marketingReceipt.findMany({ where: { dailyEntryId: entryId }, include: { items: true } });
        const totalSales = remaining.reduce((s, rr) => s + Number(rr.sellingTotal ?? 0), 0);
        const totalProfit = remaining.reduce((sum, rr) => {
          const items = rr.items ?? [];
          const allItemsPriced = items.length > 0 && items.every(it => Number(it.buyingPrice ?? 0) > 0);
          const aggregateCost = Number((rr).buyingTotal ?? 0);
          if (aggregateCost > 0 || allItemsPriced) {
            const buying = items.reduce((inner, it) => inner + Number(it.buyingPrice ?? 0), 0);
            const costToUse = aggregateCost > 0 ? aggregateCost : buying;
            return sum + (Number(rr.sellingTotal ?? 0) - costToUse);
          }
          return sum;
        }, 0);
        await tx.marketingDailyEntry.update({ where: { id: entryId }, data: { totalSales, totalProfit } });
        console.log('Recalced marketing entry', entryId, 'totals', totalSales, totalProfit);
      }

      // Recalc support entries totals
      for (const entryId of supportEntryIdsToRecalc) {
        const remaining = await tx.supportReceipt.findMany({ where: { dailyEntryId: entryId }, include: { items: true } });
        const totalSales = remaining.reduce((s, rr) => s + Number(rr.sellingTotal ?? 0), 0);
        const totalProfit = remaining.reduce((sum, rr) => {
          const items = rr.items ?? [];
          const allItemsPriced = items.length > 0 && items.every(it => Number(it.buyingPrice ?? 0) > 0);
          const aggregateCost = Number((rr).buyingTotal ?? 0);
          if (aggregateCost > 0 || allItemsPriced) {
            const buying = items.reduce((inner, it) => inner + Number(it.buyingPrice ?? 0), 0);
            const costToUse = aggregateCost > 0 ? aggregateCost : buying;
            return sum + (Number(rr.sellingTotal ?? 0) - costToUse);
          }
          return sum;
        }, 0);
        await tx.supportDailyEntry.update({ where: { id: entryId }, data: { totalSales, totalProfit } });
        console.log('Recalced support entry', entryId, 'totals', totalSales, totalProfit);
      }
    });

    console.log('Deletion transaction complete.');
  } catch (e) {
    console.error('Failed:', e && e.stack ? e.stack : e);
    process.exit(1);
  } finally {
    try { await p.$disconnect(); } catch (_) {}
  }
}

main();
