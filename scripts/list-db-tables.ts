import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['warn', 'error'] });

async function listTables() {
  try {
    console.info('Querying information_schema for tables (excluding system schemas)...');
    const tables: Array<{ table_schema: string; table_name: string }> = await prisma.$queryRaw`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `;

    console.info(`Found ${tables.length} tables`);

    // Show any tables that look like receipts/orders
    const patterns = ['receipt', 'receipts', 'order', 'orders', 'marketing', 'support'];
    const matches = tables.filter(t => patterns.some(p => t.table_name.toLowerCase().includes(p)));

    if (matches.length) {
      console.info('Tables matching receipt/order patterns:');
      for (const m of matches) console.info(` - ${m.table_schema}.${m.table_name}`);
    } else {
      console.info('No receipt/order-like table names found.');
    }

    // If any receipt-like tables found, show counts and sample rows
    for (const m of matches) {
      try {
        const fullName = `${m.table_schema}.${m.table_name}`;
        const countRes: Array<{ count: string }> = await prisma.$queryRawUnsafe(`SELECT count(*)::text AS count FROM "${m.table_schema}"."${m.table_name}"`);
        const count = countRes?.[0]?.count ?? 'unknown';
        console.info(`\nTable: ${fullName} (rows: ${count})`);
        const sample: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "${m.table_schema}"."${m.table_name}" LIMIT 5`);
        if (sample.length) {
          console.info('Sample rows (first row keys):', Object.keys(sample[0]));
        } else {
          console.info('No sample rows.');
        }
      } catch (err) {
        console.warn('Failed to inspect table', `${m.table_schema}.${m.table_name}`, err instanceof Error ? err.message : String(err));
      }
    }

    // Also print a short list of the first 50 table names to help navigation
    console.info('\nFirst 50 tables:');
    tables.slice(0, 50).forEach(t => console.info(` - ${t.table_schema}.${t.table_name}`));
  } catch (err) {
    console.error('Error querying database for tables:', err instanceof Error ? err.message : String(err));
    process.exitCode = 2;
  } finally {
    try {
      await prisma.$disconnect();
    } catch {}
  }
}

listTables().catch(e => { console.error(e); process.exit(1); });
