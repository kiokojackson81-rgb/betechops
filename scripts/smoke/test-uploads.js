(async () => {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  console.log('Using BASE_URL=', base);

  try {
    const filename = `smoke-${Math.random().toString(36).slice(2,8)}.png`;
    const res = await fetch(`${base}/api/uploads/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, contentType: 'image/png' }),
    });
    const j = await res.json();
    console.log('sign:', res.status, j);
    if (!res.ok) process.exitCode = 2;
  } catch (err) {
    console.error('upload smoke failed', err);
    process.exitCode = 2;
  }
})();
