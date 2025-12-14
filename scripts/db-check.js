const { Client } = require('pg')

async function run() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('Please set the DATABASE_URL environment variable')
    process.exit(1)
  }

  const client = new Client({ connectionString: url })
  await client.connect()

  try {
    console.log('=== Tables matching support/receipt ===')
    const t = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%support%' OR table_name ILIKE '%receipt%') ORDER BY table_name;")
    console.log(t.rows)

    console.log('\n=== Columns for matching tables ===')
    const c = await client.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND (table_name ILIKE '%support%' OR table_name ILIKE '%receipt%') ORDER BY table_name, ordinal_position;")
    console.log(c.rows.slice(0,200))

    const receiptId = 'cmira41040002l204fiy8rib4'
    const itemId = 'cmira41040003l204ubcz9vys'
    const entryId = 'cmira41040001l204oby0ovg8'

    const tryTables = ['SupportReceipt','support_receipt','supportreceipt','support_receipts','support_receipts','SupportReceiptItem','support_receipt_item','SupportDailyEntry','support_daily_entry']

    for (const tbl of tryTables) {
      try {
        const r = await client.query(`SELECT * FROM "${tbl}" WHERE id=$1 LIMIT 1`, [receiptId])
        if (r.rows.length) {
          console.log(`\nFound row in table ${tbl}:`, r.rows[0])
        }
      } catch (e) {
        // ignore
      }
    }

      // Check receipt items for the receipt and the specific item id
      try {
        const items = await client.query('SELECT * FROM "SupportReceiptItem" WHERE "receiptId" = $1', [receiptId])
        console.log('\nSupportReceiptItem rows for receipt:', items.rows)
      } catch (e) {
        console.log('\nSupportReceiptItem query failed:', e.message)
      }
      try {
        const item = await client.query('SELECT * FROM "SupportReceiptItem" WHERE id = $1', [itemId])
        console.log('\nSupportReceiptItem by id:', item.rows)
      } catch (e) {
        console.log('\nSupportReceiptItem by id failed:', e.message)
      }

    // Try to find the entry rows for the attendant and compute sums
    const attendant = 'cmiqttmf10000v55sw48jeawd'
    const periodStart = '2025-11-25'
    const periodEnd = '2025-12-24'

    // Try a few variants for daily entry table
    const dailyCandidates = ['SupportDailyEntry','support_daily_entry','supportdailyentry','support_daily_entries']
    for (const d of dailyCandidates) {
      try {
        const q = `SELECT COUNT(*) AS entries, SUM(total_sales::numeric) AS total_sales, SUM(total_profit::numeric) AS total_profit FROM "${d}" WHERE submitted_by=$1 AND date BETWEEN $2 AND $3`;
        const res = await client.query(q, [attendant, periodStart, periodEnd])
        if (res && res.rows && res.rows.length) {
          const row = res.rows[0]
          if (row.entries !== '0' && (row.total_profit !== null)) {
            console.log(`\nAggregates from ${d}:`, row)
          } else {
            console.log(`\n${d} returned:`, row)
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // Also try selecting the specific SupportDailyEntry by id
    try {
      const entry = await client.query('SELECT * FROM "SupportDailyEntry" WHERE id = $1', [entryId])
      console.log('\nSupportDailyEntry by id:', entry.rows)
    } catch (e) {
      console.log('\nSupportDailyEntry by id failed:', e.message)
    }

    // Compute period aggregates and expected 5% commission explicitly
    try {
      const aggQ = `SELECT COUNT(*) AS period_entries, SUM("totalSales")::numeric AS period_total_sales, SUM("totalProfit")::numeric AS period_total_profit, (SUM("totalProfit") * 0.05)::numeric(10,2) AS expected_commission_5pct FROM "SupportDailyEntry" WHERE "submittedById" = $1 AND date BETWEEN $2 AND $3`;
      const agg = await client.query(aggQ, [attendant, periodStart, periodEnd])
      console.log('\nComputed aggregates and 5% commission:', agg.rows)
    } catch (e) {
      console.log('\nAggregate commission query failed:', e.message)
    }

    // Try to map the submittedById to a user/account
    try {
      console.log('\n=== Attempting to map submittedById to user record ===')
      const userCandidates = ['User', 'Users', 'Attendant', 'Attendants', 'Account', 'Accounts']
      for (const u of userCandidates) {
        try {
          const res = await client.query(`SELECT * FROM "${u}" WHERE id = $1 LIMIT 1`, [attendant])
          if (res.rows && res.rows.length) {
            console.log(`Found mapping in table ${u}:`, res.rows[0])
          }
        } catch (e) {
          // ignore missing table
        }
      }
    } catch (e) {
      console.log('User mapping query failed:', e.message)
    }

    // As a fallback, compute using join across receipts and items if tables exist
    try {
      const joinQ = `SELECT r.id as receipt_id, r.selling_total, ri.id as item_id, ri.buying_price
FROM public.support_receipt r
JOIN public.support_receipt_item ri ON ri.receipt_id = r.id
WHERE r.id = $1`;
      const jr = await client.query(joinQ, [receiptId])
      console.log('\nJoin query fallback results:', jr.rows)
    } catch (e) {
      // ignore
    }

  } finally {
    await client.end()
  }
}

run().catch(e=>{ console.error(e); process.exit(1) })
