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
    if (!decoded.startsWith('/marketing/tracker')) {
      console.error('callbackUrl does not point to marketing/tracker:', decoded);
      await browser.close();
      process.exit(4);
    }
    console.log('SMOKE OK: middleware redirected to login and preserved callbackUrl ->', decoded);
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Error inspecting result URL:', err);
    await browser.close();
    process.exit(11);
  }
})();
