const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const storageState = path.resolve('tests/smoke/storageState.json');
  if (!fs.existsSync(storageState)) {
    console.error('storageState not found at', storageState);
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }));

  const url = 'https://ops.betech.co.ke/attendant/daily-report';
  console.log('Visiting', url);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Get session via API
  const session = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/auth/session');
      if (!r.ok) return { status: r.status };
      return await r.json();
    } catch (err) {
      return { error: String(err) };
    }
  });
  console.log('session:', session);

  // Inspect localStorage keys related to lock
  const lockKey = 'lock:marketing:quickstats';
  const lsVal = await page.evaluate(k => localStorage.getItem(k), lockKey);
  console.log(lockKey, 'before click =', lsVal);

  // Find lock button
  const sel = 'button[title*="Lock"], button:has-text("Lock"), button:has-text("Unlock")';
  const btn = await page.$(sel);
  if (!btn) {
    console.error('Lock button not found with selector', sel);
    console.log('Collected console logs:', logs);
    await browser.close();
    process.exit(3);
  }

  // Click the button
  console.log('Clicking lock button');
  await btn.click();
  await page.waitForTimeout(1000);

  const lsValAfter = await page.evaluate(k => localStorage.getItem(k), lockKey);
  console.log(lockKey, 'after click =', lsValAfter);

  console.log('Collected console logs:', logs);

  await browser.close();
})();
