const { chromium } = require('playwright');
const fs = require('fs');

async function runFor(target, outName) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    logs.push({ type: 'console', text: msg.text(), location: msg.location() });
    console.log('CONSOLE:', msg.type(), msg.text());
  });
  page.on('pageerror', err => {
    logs.push({ type: 'pageerror', text: err.message });
    console.error('PAGEERROR:', err.message);
  });
  page.on('requestfailed', req => {
    logs.push({ type: 'requestfailed', url: req.url(), failure: req.failure() });
    console.error('REQFAILED:', req.url(), req.failure());
  });

  console.log('Visiting', target);
  try {
    await page.goto(target, { waitUntil: 'networkidle' });
  } catch (err) {
    console.error('Navigation failed:', err);
  }

  // Save initial screenshot
  const base = `tests/smoke/out-${outName}`;
  await page.screenshot({ path: base + '-before.png', fullPage: true }).catch(()=>{});

  // Try to find an "Unlock" button by text or with aria-label
  const unlockSelectors = ["text=Unlock", "button:has-text('Unlock')", "[aria-label='Unlock']", "button[title='Unlock']"];
  let clicked = false;
  for (const sel of unlockSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        console.log('Found unlock selector:', sel);
        await el.click({ timeout: 5000 }).catch(e => console.error('Click failed:', e.message));
        clicked = true;
        await page.waitForTimeout(1000);
        break;
      }
    } catch (err) {
      console.error('Error checking selector', sel, err.message);
    }
  }

  if (!clicked) console.warn('Unlock button not found on page (tried selectors)', unlockSelectors);

  await page.screenshot({ path: base + '-after.png', fullPage: true }).catch(()=>{});

  // Save captured logs
  try {
    fs.writeFileSync(base + '-logs.json', JSON.stringify(logs, null, 2));
  } catch (err) {
    console.error('Failed to write logs file:', err.message);
  }

  await browser.close();
}

(async () => {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error('Usage: node unlock-button-smoke.js <url1> [url2 ...]');
    process.exit(2);
  }

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const name = `target${i+1}`;
    try {
      await runFor(t, name);
      console.log('Finished', t);
    } catch (err) {
      console.error('Error running for', t, err.stack || err);
    }
  }
  process.exit(0);
})();
