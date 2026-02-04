import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

async function main() {
  const idOrNumber = process.argv[2];
  if (!idOrNumber) {
    console.error('Usage: node -r ts-node/register scripts/dump-receipt-json.ts <receiptNumber|receiptId>');
    process.exit(2);
  }

  // Try matching Receipt by id or receipt_number (case-insensitive like)
  try {
    const receipts: any[] = await prisma.$queryRaw`
      SELECT * FROM public."Receipt"
      WHERE id = ${idOrNumber} OR receipt_number ILIKE ${'%' + idOrNumber + '%'}
      LIMIT 10
    `;

    console.info('Found receipts:', receipts.length);
    for (const r of receipts) {
      console.info('--- Receipt row ---');
      console.info('id:', r.id);
      console.info('receipt_number:', r.receipt_number ?? r.receiptNumber ?? null);
      console.info('totals:', JSON.stringify(r.totals, null, 2));
      console.info('data:', JSON.stringify(r.data, null, 2));
      console.info('createdAt:', r.createdAt ?? r.created_at ?? null);
    }
    // Search numeric columns for exact 7998 / -7998 values
    console.info('Searching numeric columns for 7998 / -7998 (this may take a few seconds)');
    const numCols: any[] = await prisma.$queryRaw`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type IN ('integer','bigint','numeric','double precision','real','smallint')
    `;
    for (const c of numCols) {
      const t = c.table_name as string;
      const col = c.column_name as string;
      try {
        const q = `SELECT COUNT(*) as cnt FROM public."${t}" WHERE "${col}" = $1 OR "${col}" = $2`;
        const res: any = await prisma.$queryRawUnsafe(q, 7998, -7998);
        const cnt = Number(res[0]?.cnt ?? res[0]?.count ?? 0);
        if (cnt > 0) {
          console.info(`Numeric match in ${t}.${col}: ${cnt} rows`);
          const sampleQ = `SELECT * FROM public."${t}" WHERE "${col}" = $1 OR "${col}" = $2 LIMIT 5`;
          const rows: any[] = await prisma.$queryRawUnsafe(sampleQ, 7998, -7998);
          for (const row of rows) console.info(`--- Sample numeric row from ${t}` + JSON.stringify(row, null, 2).slice(0, 2000));
        }
      } catch (e) {
        // ignore per-table errors
      }
    }
    // Search public schema columns (json/text/varchar) for the string '7998'
    console.info('Searching public schema for string "7998" (this may take a few seconds)');
    const cols: any[] = await prisma.$queryRaw`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type IN ('json','jsonb','text','character varying')
    `;
    const needle = '%7998%';
    for (const c of cols) {
      const t = c.table_name as string;
      const col = c.column_name as string;
      try {
        const q = `SELECT COUNT(*) as cnt FROM public."${t}" WHERE CAST(\"${col}\" AS text) ILIKE $1`;
        const res: any = await prisma.$queryRawUnsafe(q, needle);
        const cnt = Number(res[0]?.cnt ?? res[0]?.count ?? 0);
        if (cnt > 0) {
          console.info(`Match in ${t}.${col}: ${cnt} rows`);
          const sampleQ = `SELECT * FROM public."${t}" WHERE CAST(\"${col}\" AS text) ILIKE $1 LIMIT 5`;
          const rows: any[] = await prisma.$queryRawUnsafe(sampleQ, needle);
          for (const row of rows) {
            console.info(`--- Sample row from ${t}`);
            console.info(JSON.stringify(row, null, 2).slice(0, 2000));
          }
        }
      } catch (e) {
        // ignore per-table errors
      }
    }
    // Also search for serial/receipt identifier text so we can find related rows
    const serialNeedle = '%' + idOrNumber + '%';
    for (const c of cols) {
      const t = c.table_name as string;
      const col = c.column_name as string;
      try {
        const q = `SELECT COUNT(*) as cnt FROM public."${t}" WHERE CAST(\"${col}\" AS text) ILIKE $1`;
        const res: any = await prisma.$queryRawUnsafe(q, serialNeedle);
        const cnt = Number(res[0]?.cnt ?? res[0]?.count ?? 0);
        if (cnt > 0) {
          console.info(`Match for serial in ${t}.${col}: ${cnt} rows`);
          const sampleQ = `SELECT * FROM public."${t}" WHERE CAST(\"${col}\" AS text) ILIKE $1 LIMIT 5`;
          const rows: any[] = await prisma.$queryRawUnsafe(sampleQ, serialNeedle);
          for (const row of rows) {
            console.info(`--- Sample row for serial from ${t}`);
            console.info(JSON.stringify(row, null, 2).slice(0, 2000));
          }
        }
      } catch (e) {
        // ignore per-table errors
      }
    }
    // Also try to find linked Order rows by orderNumber
    const orders: any[] = await prisma.$queryRaw`
      SELECT * FROM public."Order" WHERE "orderNumber" ILIKE ${'%' + idOrNumber + '%'} LIMIT 10
    `;
    console.info('Found orders:', orders.length);
    for (const o of orders) {
      console.info('--- Order row ---');
      console.info('id:', o.id);
      console.info('orderNumber:', o.orderNumber ?? o.order_number ?? null);
      console.info('totals:', JSON.stringify(o.totals, null, 2));
      console.info('data:', JSON.stringify(o.data, null, 2));
      // find receipt by orderId
      try {
        const recs: any[] = await prisma.$queryRaw`
          SELECT * FROM public."Receipt" WHERE "orderId" = ${o.id} LIMIT 5
        `;
        console.info('linked receipts for order:', recs.length);
        for (const r2 of recs) {
          console.info('--- Linked Receipt ---');
          console.info('id:', r2.id);
          console.info('receipt_number:', r2.receipt_number ?? r2.receiptNumber ?? null);
          console.info('totals:', JSON.stringify(r2.totals, null, 2));
          console.info('data:', JSON.stringify(r2.data, null, 2));
        }
      } catch (e) {
        const msg = (e as any)?.message ?? String(e);
        console.warn('error querying linked receipts', msg);
      }
      // find order items and associated OrderCost rows
      try {
        const items: any[] = await prisma.$queryRaw`
          SELECT * FROM public."OrderItem" WHERE "orderId" = ${o.id}
        `;
        console.info('order items:', items.length);
        for (const it of items) {
          console.info('--- OrderItem ---');
          console.info(JSON.stringify(it, null, 2));
          try {
            const costs: any[] = await prisma.$queryRaw`
              SELECT * FROM public."OrderCost" WHERE "orderItemId" = ${it.id}
            `;
            console.info('order costs for item:', costs.length);
            for (const c of costs) console.info(JSON.stringify(c, null, 2));
          } catch (e) {
            // ignore
          }
        }
        // inspect product to see if cost is stored there (for first item)
        if (items && items.length) {
          try {
            const prod = await prisma.$queryRaw`
              SELECT * FROM public."Product" WHERE id = ${items[0].productId} LIMIT 1
            `;
            if (prod && Array.isArray(prod) && prod.length) console.info('Product row:', JSON.stringify(prod[0], null, 2));
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // ignore
      }
    }
    
  } catch (err) {
    console.error('Query error', err);
    process.exit(3);
  } finally {
    await prisma.$disconnect();
  }
}

main();
