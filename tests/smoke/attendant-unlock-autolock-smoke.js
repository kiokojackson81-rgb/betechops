const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function exists(p) {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

async function run() {
  const baseUrl = process.env.TARGET_URL || 'https://ops.betech.co.ke';
  const storageStatePath = process.env.STORAGE_STATE || path.resolve('tests/smoke/storageState.json');
  const username = process.env.LOGIN_USER;
  const password = process.env.LOGIN_PASS;
  const autoLockMs = process.env.TEST_AUTOLOCK_MS ? Number(process.env.TEST_AUTOLOCK_MS) : 5 * 60 * 1000;

  const browser = await chromium.launch();

  let context;
  if (await exists(storageStatePath)) {
    console.log('Using storageState from', storageStatePath);
    context = await browser.newContext({ storageState: storageStatePath });
  } else if (username && password) {
    console.log('No storageState found — performing login using env credentials');
    context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl + '/attendant/login', { waitUntil: 'networkidle' });
    // Attempt to fill common login fields — adapt if app uses named inputs
    try {
      await page.fill('input[name="email"], input[name="username"], input[type="email"]', username);
    } catch (e) {
      // ignore if selector not found
    }
    try {
      await page.fill('input[name="password"], input[type="password"]', password);
    } catch (e) {
    }
    // Submit form
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').catch(() => {}),
    ]).catch(() => {});

    // Save storage state for later runs
    try {
      await context.storageState({ path: storageStatePath });
      console.log('Saved storageState to', storageStatePath);
    } catch (err) {
      console.warn('Failed to save storage state:', err.message);
    }
  } else {
    console.error('No storage state found and no credentials provided. Set STORAGE_STATE env or LOGIN_USER and LOGIN_PASS.');
    await browser.close();
    process.exit(2);
  }

  const page = await context.newPage();

  // Navigate to the daily-report page which contains the lock control
  const target = baseUrl + '/attendant/daily-report';
  console.log('Visiting', target);
  await page.goto(target, { waitUntil: 'networkidle' });

  // Selector heuristics for lock/unlock button
  const lockButtonSelectors = [
    'button[title*="Lock"]',
    'button[title*="Unlock"]',
    'button:has-text("Lock")',
    'button:has-text("Unlock")',
  ];

  let lockButton = null;
  for (const sel of lockButtonSelectors) {
    lockButton = await page.$(sel);
    if (lockButton) {
      console.log('Found lock button with selector', sel);
      break;
    }
  }

  if (!lockButton) {
    console.error('Could not find lock/unlock button on page.');
    await context.close();
    await browser.close();
    process.exit(3);
  }

  // Helper to read locked state from button title or aria-pressed attribute
  async function isLocked() {
    try {
      const title = await lockButton.getAttribute('title');
      if (title) return title.toLowerCase().includes('lock') && !title.toLowerCase().includes('unlock');
      const aria = await lockButton.getAttribute('aria-pressed');
      if (aria !== null) return !(aria === 'true');
    } catch (e) {
      // fallback
    }
    // As a last resort, check visible text
    const txt = (await lockButton.innerText()).toLowerCase();
    return txt.includes('lock') && !txt.includes('unlock');
  }

  // If initially locked, try unlocking
  let initiallyLocked = await isLocked();
  console.log('Initially locked?', initiallyLocked);

  if (initiallyLocked) {
    console.log('Clicking unlock (should not redirect when authenticated)');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
      lockButton.click().catch(() => {}),
    ]);
    await page.waitForTimeout(500);
  }

  // Re-locate the button (page may have re-rendered)
  for (const sel of lockButtonSelectors) {
    lockButton = await page.$(sel);
    if (lockButton) break;
  }

  const afterUnlockLocked = await isLocked();
  console.log('Locked after clicking unlock?', afterUnlockLocked);

  if (!afterUnlockLocked) {
    console.log('Card is unlocked. Waiting for auto-lock (ms):', autoLockMs);
    // Wait for auto-lock duration plus a small buffer
    await page.waitForTimeout(autoLockMs + 2000);

    // Re-locate button and verify it is locked again
    for (const sel of lockButtonSelectors) {
      lockButton = await page.$(sel);
      if (lockButton) break;
    }
    const lockedAfterTimer = await isLocked();
    console.log('Locked after timer?', lockedAfterTimer);
    if (lockedAfterTimer) {
      console.log('SMOKE OK: unlock -> auto-lock behavior works');
      await context.close();
      await browser.close();
      process.exit(0);
    } else {
      console.error('Auto-lock did not re-lock the card as expected');
      await context.close();
      await browser.close();
      process.exit(4);
    }
  } else {
    console.error('Card remained locked after attempted unlock — likely redirect to login or missing session');
    await context.close();
    await browser.close();
    process.exit(5);
  }
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(10);
});
