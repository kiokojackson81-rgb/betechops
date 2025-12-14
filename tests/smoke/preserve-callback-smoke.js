const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const target = process.argv[2] || process.env.TARGET_URL || 'http://localhost:3000/marketing/tracker?impersonateId=cmimxqf9t0003v5mcjdq8x61p';
  console.log('Visiting', target);
  try {
    await page.goto(target, { waitUntil: 'networkidle' });
  } catch (err) {
    console.error('Navigation failed:', err);
    await browser.close();
    process.exit(10);
  }

  const url = page.url();
  console.log('Landed on', url);
  try {
    const u = new URL(url);
    if (u.pathname !== '/attendant/login') {
      console.error('Unexpected pathname (expected /attendant/login):', u.pathname);
      await browser.close();
      process.exit(2);
    }
    const cb = u.searchParams.get('callbackUrl');
    if (!cb) {
      console.error('callbackUrl query param missing from login redirect URL');
      await browser.close();
      process.exit(3);
    }
    const decoded = decodeURIComponent(cb);

    // Support two valid patterns:
    // 1) Direct: callbackUrl=%2Fmarketing%2Ftracker... (older behavior)
    // 2) Wrapped: callbackUrl=%2Fauth%2Fpost-login%3FcallbackUrl%3D%252Fmarketing%252Ftracker... (new middleware)
    if (decoded.startsWith('/marketing/tracker')) {
      console.log('SMOKE OK: middleware redirected to login and preserved callbackUrl ->', decoded);
      await browser.close();
      process.exit(0);
    }

    // If wrapped, parse nested callbackUrl param
    try {
      const nested = new URL('http://localhost' + decoded);
      const nestedCb = nested.searchParams.get('callbackUrl');
      if (nestedCb && decodeURIComponent(nestedCb).startsWith('/marketing/tracker')) {
        console.log('SMOKE OK: middleware redirected to login and preserved nested callbackUrl ->', decodeURIComponent(nestedCb));
        await browser.close();
        process.exit(0);
      }
    } catch (err) {
      // fall through to error below
    }

    console.error('callbackUrl does not point to marketing/tracker (direct or nested):', decoded);
    await browser.close();
    process.exit(4);
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Error inspecting result URL:', err);
    await browser.close();
    process.exit(11);
  }
})();
