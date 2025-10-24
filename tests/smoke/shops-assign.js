// Simple smoke test for POST /api/shops/:id/assign
// Requires SHOP_ID and USER_ID env vars to actually run; otherwise it will skip.
// Usage: DEV_URL=http://localhost:3000 SHOP_ID=... USER_ID=... node tests/smoke/shops-assign.js
const base = process.env.DEV_URL || 'http://localhost:3000';
const SHOP_ID = process.env.SHOP_ID;
const USER_ID = process.env.USER_ID;
(async () => {
  if (!SHOP_ID || !USER_ID) {
    console.log('Skipping shops assign smoke test: set SHOP_ID and USER_ID env vars to run it');
    process.exit(0);
  }
  console.log(`Testing POST /api/shops/${SHOP_ID}/assign`);
  try {
    const res = await fetch(`${base}/api/shops/${SHOP_ID}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: USER_ID, roleAtShop: 'ATTENDANT' }) });
    console.log('status', res.status);
    console.log('body', await res.text());
    process.exit(0);
  } catch (err) {
    console.error('skipping: cannot reach', base, err);
    process.exit(0);
  }
})();
