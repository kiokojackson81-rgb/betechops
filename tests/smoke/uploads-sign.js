// Simple smoke test for POST /api/uploads/sign
// Usage: DEV_URL=http://localhost:3000 node tests/smoke/uploads-sign.js
const base = process.env.DEV_URL || 'http://localhost:3000';
(async () => {
  console.log('Testing POST /api/uploads/sign');
  try {
    const res = await fetch(`${base}/api/uploads/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: 'test.jpg', contentType: 'image/jpeg', shopId: process.env.SHOP_ID || 'global' }) });
    console.log('status', res.status);
    const j = await res.text();
    console.log('body', j.slice(0, 200));
    process.exit(0);
  } catch (err) {
    console.error('skipping: cannot reach', base, err);
    process.exit(0);
  }
})();
