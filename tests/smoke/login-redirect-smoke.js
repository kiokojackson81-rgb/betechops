const { chromium } = require('playwright');

async function run() {
  const target = process.argv[2] || process.env.TARGET_URL;
  const email = process.argv[3] || process.env.TEST_EMAIL;
  const password = process.argv[4] || process.env.TEST_PASSWORD;

  if (!target || !email || !password) {
    console.error('Usage: node login-redirect-smoke.js <targetUrl> <email> <password>');
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Visiting', target);
    await page.goto(target, { waitUntil: 'networkidle', timeout: 30000 });

    // If we landed directly on the target (already authenticated), we still
    // want to confirm it's the marketing tracker.
    let url = page.url();
    console.log('Landed on', url);

    // If we are on login page, fill and submit the form
    if (url.includes('/attendant/login') || url.includes('/login')) {
      console.log('Detected login page; performing credentials sign-in');
      // Fill form fields
      await page.fill('input[type="email"]', email);
      await page.fill('input[type="password"]', password);
      // Submit
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
        page.click('button[type="submit"]'),
      ]);
      url = page.url();
      console.log('After sign-in landed on', url);
    }

    // Evaluate final URL
    const final = new URL(url);
    if (final.pathname.startsWith('/marketing/tracker') && final.searchParams.get('impersonateId')) {
      console.log('SIGN-IN SMOKE OK: final page is marketing/tracker with impersonateId ->', final.href);
      await browser.close();
      process.exit(0);
    }

    console.error('SIGN-IN SMOKE FAILED: final URL not marketing/tracker?impersonateId=... ->', final.href);
    await browser.close();
    process.exit(3);
  } catch (err) {
    console.error('Error during smoke test:', err);
    await browser.close();
    process.exit(11);
  }
}

run();
