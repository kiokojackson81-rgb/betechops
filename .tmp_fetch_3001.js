const urls = [
  'http://127.0.0.1:3001/api/debug/oidc',
  'http://127.0.0.1:3001/api/reports/summary',
  'http://127.0.0.1:3001/api/orders/pending-pricing',
  'http://127.0.0.1:3001/api/returns/waiting-pickup',
  'http://127.0.0.1:3001/api/reports/sales-today',
];

async function run() {
  for (const u of urls) {
    console.log('\n===', u, '===');
    try {
      const res = await fetch(u, { method: 'GET' });
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        console.log(JSON.stringify(json, null, 2));
      } catch (e) {
        console.log('RESPONSE_TEXT:');
        console.log(text);
      }
    } catch (err) {
      console.log('ERROR:', err && err.message ? err.message : String(err));
    }
  }
}

run().catch(e=>{ console.error('RUN_ERR', e); process.exit(1); });
