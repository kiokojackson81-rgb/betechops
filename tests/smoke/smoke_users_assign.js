// Simple smoke script for /api/users and /api/shops/[id]/assign
// Uses global fetch (Node 18+). Set BASE_URL to your running dev server.

async function run() {
  const base = process.env.BASE_URL || 'http://localhost:3000';

  console.log('Creating user...');
  const res = await fetch(`${base}/api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `smoke+${Date.now()}@example.com`, name: 'Smoke Tester' }) });
  const j = await res.json();
  if (!res.ok) { console.error('Create user failed', j); process.exit(2); }
  const user = j.user;
  console.log('User created', user.id);

  // we need a shop id to assign to — try to fetch first shop
  const shopsRes = await fetch(`${base}/api/sync/orders?simulate=true`);
  const shopsJson = await shopsRes.json();
  const shopId = shopsJson.shops?.[0]?.id;
  if (!shopId) { console.warn('No shop found to assign; skipping assign test'); process.exit(0); }

  console.log('Assigning user to shop', shopId);
  const assignRes = await fetch(`${base}/api/shops/${shopId}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, roleAtShop: 'ATTENDANT' }) });
  const assignJson = await assignRes.json();
  if (!assignRes.ok) { console.error('Assign failed', assignJson); process.exit(3); }
  console.log('Assigned:', assignJson.assignment?.id);
}

run().catch(e => { console.error(e); process.exit(1); });
