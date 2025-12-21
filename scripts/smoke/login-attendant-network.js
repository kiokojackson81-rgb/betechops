const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const base = 'https://ops.betech.co.ke';
  const loginUrl = `${base}/attendant/login`;
  const reportUrl = `${base}/attendant/daily-report`;

  page.on('response', async (resp) => {
    try {
      const url = resp.url();
      if (!url.includes('/api/') && !url.includes('.json')) return;
      const ct = resp.headers()['content-type'] || '';
      if (ct.includes('application/json') || url.match(/summary|report|commission|daily|stats|online/i)) {
        let txt = await resp.text().catch(() => null);
        if (!txt) return;
        // try to parse json
        try {
          const j = JSON.parse(txt);
          console.log('API RESPONSE', url);
          console.log(JSON.stringify(j, null, 2).slice(0, 2000));
        } catch (e) {
          console.log('RAW RESPONSE', url, txt.slice(0, 1000));
        }
      }
    } catch (err) {
      // ignore
    }
  });

  try {
    console.log('Going to login page...');
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for inputs and fill
    await page.waitForTimeout(1500);
    const emailSel = 'input[type="email"]';
    const pwSel = 'input[type="password"]';
    await page.fill(emailSel, 'brendah@betech.co.ke').catch(() => {});
    await page.fill(pwSel, 'brendah@#2020').catch(() => {});

    // submit
    const btn = await page.$('button[type="submit"]');
    if (btn) await btn.click(); else await page.press(pwSel, 'Enter');

    // Wait a bit
    await page.waitForTimeout(3000);

    console.log('Navigate to daily report...');
    await page.goto(reportUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});

    // wait so that API calls complete
    await page.waitForTimeout(5000);

    console.log('Done capturing network responses.');

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Network smoke error:', err);
    try { await browser.close(); } catch (e) {}
    process.exit(2);
  }
})();
