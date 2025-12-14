const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const base = 'https://ops.betech.co.ke';
  const loginUrl = `${base}/attendant/login`;
  const reportUrl = `${base}/attendant/daily-report`;

  try {
    console.log('Navigating to login page...');
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for any input to appear
    await page.waitForTimeout(1500);

    // Try common selectors for email and password
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
      console.log('Could not find login inputs via simple selectors; waiting for client JS to render...');
      // Wait longer for client to hydrate
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

    // Fill credentials
    await page.fill(emailSel, 'brendah@betech.co.ke');
    await page.fill(pwSel, 'brendah@#2020');

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
      // try pressing Enter in password field
      await page.press(pwSel, 'Enter').catch(() => {});
    }

    // Wait for navigation / auth
    await page.waitForTimeout(3000);

    // Navigate to daily report
    console.log('Navigating to daily report...');
    await page.goto(reportUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Try to extract commission metrics from the dashboard
    const pageText = await page.innerText('body');

    // Try to find patterns for commission values
    const patterns = [/COMMISSION\D*KES\s*([0-9,]+)/i, /COMMISSION\D*([0-9,]+)\s*KES/i, /COMMISSION\D*([0-9,]+)/i];
    const matches = {};
    for (const p of patterns) {
      const m = pageText.match(p);
      if (m) { matches[p.toString()] = m[1]; }
    }

    console.log('Commission matches found:', matches);

    // Also print a small section around the word "Commission" for manual inspection
    const idx = pageText.toUpperCase().indexOf('COMMISSION');
    if (idx >= 0) {
      const snippet = pageText.slice(Math.max(0, idx-200), idx+200);
      console.log('Snippet around COMMISSION:\n', snippet);
    } else {
      console.log('No literal COMMISSION word found in text. Showing beginning of body:');
      console.log(pageText.slice(0, 2000));
    }

    // Take a screenshot (saved in repo) for manual review
    const out = 'artifacts/attendant-daily-report.png';
    await page.screenshot({ path: out, fullPage: true });
    console.log('Saved screenshot to', out);

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Error during smoke script:', err);
    try { await browser.close(); } catch (e) {}
    process.exit(3);
  }
})();
