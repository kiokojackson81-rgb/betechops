const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const base = 'https://ops.betech.co.ke';
  const loginUrl = `${base}/admin/login`;
  const reportUrl = `${base}/admin/daily-report?impersonateId=cmimxqfnr0005v5mc05nwhg9o`;

  try {
    console.log('Navigating to admin login page...');
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    const emailSelectors = ['input[type="email"]', 'input[name="email"]', 'input[name="username"]', 'input[placeholder*="Email"]', 'input[placeholder*="email"]', 'input[type="text"]'];
    const pwSelectors = ['input[type="password"]', 'input[name="password"]', 'input[placeholder*="Password"]'];

    let emailSel = null;
    for (const s of emailSelectors) {
      const el = await page.$(s);
      if (el) { emailSel = s; break; }
    }

    let pwSel = null;
    for (const s of pwSelectors) {
      const el = await page.$(s);
      if (el) { pwSel = s; break; }
    }

    console.log('Found selectors:', { emailSel, pwSel });

    if (!emailSel || !pwSel) {
      console.log('Login form inputs not found; waiting for client JS to render...');
      await page.waitForSelector('input', { timeout: 10000 }).catch(() => {});
      for (const s of emailSelectors) {
        const el = await page.$(s);
        if (el) { emailSel = s; break; }
      }
      for (const s of pwSelectors) {
        const el = await page.$(s);
        if (el) { pwSel = s; break; }
      }
    }

    if (!emailSel || !pwSel) {
      console.error('Login form inputs not found. Dumping page HTML for inspection...');
      const html = await page.content();
      console.log(html.slice(0, 4000));
      await browser.close();
      process.exit(2);
    }

    // Fill admin credentials (seeded in prisma/seed.ts)
    await page.fill(emailSel, 'jackson@betech.co.ke');
    await page.fill(pwSel, 'Ads0k015@#');

    // Try to click a sign-in button
    const btnSelectors = ['button[type="submit"]', 'button:has-text("Sign in")', 'button:has-text("Sign In")', 'button:has-text("Login")', 'button:has-text("Log in")'];
    let clicked = false;
    for (const bs of btnSelectors) {
      try {
        const b = await page.$(bs);
        if (b) { await b.click(); clicked = true; break; }
      } catch (e) {}
    }

    if (!clicked) {
      await page.press(pwSel, 'Enter').catch(() => {});
    }

    await page.waitForTimeout(3000);

    // Navigate to admin daily report with impersonation
    console.log('Navigating to admin daily report (impersonating) ...');
    await page.goto(reportUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const pageText = await page.innerText('body');

    // Take a screenshot
    const out = 'artifacts/admin-impersonate-daily-report.png';
    await page.screenshot({ path: out, fullPage: true });
    console.log('Saved screenshot to', out);

    // Also fetch the marketing summary JSON from the authenticated session
    try {
      const apiUrl = `/api/marketing/report/summary?date=2025-12-08&impersonateId=cmimxqfnr0005v5mc05nwhg9o`;
      const json = await page.evaluate(async (u) => {
        try {
          const res = await fetch(u, { method: 'GET', credentials: 'same-origin' });
          return { status: res.status, body: await res.json().catch(() => null) };
        } catch (e) { return { error: String(e) }; }
      }, apiUrl);
      console.log('Authenticated marketing summary API response:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.error('Failed to fetch marketing summary from page context:', e);
    }

    // Print snippet around COMMISSION for quick check
    const idx = pageText.toUpperCase().indexOf('COMMISSION');
    if (idx >= 0) {
      const snippet = pageText.slice(Math.max(0, idx-200), idx+200);
      console.log('Snippet around COMMISSION:\n', snippet);
    } else {
      console.log('No literal COMMISSION word found in text. Showing beginning of body:');
      console.log(pageText.slice(0, 2000));
    }

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Error during admin impersonation smoke script:', err);
    try { await browser.close(); } catch (e) {}
    process.exit(3);
  }
})();
