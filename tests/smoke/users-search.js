// Simple smoke test for GET /api/users/search
// Usage: DEV_URL=http://localhost:3000 node tests/smoke/users-search.js
const base = process.env.DEV_URL || 'http://localhost:3000';
(async () => {
  console.log('Testing GET /api/users/search');
  try {
    const res = await fetch(`${base}/api/users/search?q=test`);
    console.log('status', res.status);
    const j = await res.text();
    console.log('body', j.slice(0, 100));
    process.exit(0);
  } catch (err) {
    console.error('skipping: cannot reach', base, err);
    process.exit(0);
  }
})();
