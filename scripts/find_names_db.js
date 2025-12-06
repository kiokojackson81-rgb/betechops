// scans all text-like columns and searches for the strings 'benjamin' and 'stephen'
// Usage: node ./scripts/find_names_db.js

const { Client } = require('pg');
require('dotenv').config();

const SEARCH_TERMS = ['benjamin', 'stephen'];
const DATABASE_URL = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL or DIRECT_URL in .env');
  process.exit(2);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    // Get candidate text-like columns excluding system schemas
    const colRes = await client.query(
      `SELECT table_schema, table_name, column_name
       FROM information_schema.columns
       WHERE table_schema NOT IN ('pg_catalog','information_schema')
         AND data_type IN ('character varying','text')
       ORDER BY table_schema, table_name`);

    const cols = colRes.rows;
    const results = [];

    for (const r of cols) {
      const schema = r.table_schema;
      const table = r.table_name;
      const col = r.column_name;

      // Build parameterized ILIKE conditions
      const queryText = `SELECT COUNT(*) AS c FROM "${schema}"."${table}" WHERE (${SEARCH_TERMS.map((_, i) => `"${col}" ILIKE $${i + 1}`).join(' OR ')}) LIMIT 1`;
      const params = SEARCH_TERMS.map(t => `%${t}%`);

      try {
        const cntRes = await client.query(queryText, params);
        const c = parseInt(cntRes.rows[0].c, 10);
        if (c > 0) {
          // fetch up to 20 distinct matching values to show context
          const sampleQ = `SELECT DISTINCT "${col}" AS value FROM "${schema}"."${table}" WHERE (${SEARCH_TERMS.map((_, i) => `"${col}" ILIKE $${i + 1}`).join(' OR ')}) LIMIT 20`;
          const sampleRes = await client.query(sampleQ, params);
          results.push({ schema, table, column: col, count: c, samples: sampleRes.rows.map(r => r.value) });
        }
      } catch (err) {
        // ignore errors on particular columns (e.g., non-comparable col types)
      }
    }

    console.log(JSON.stringify({ searched: SEARCH_TERMS, matches: results }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
