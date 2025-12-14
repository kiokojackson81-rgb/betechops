const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

async function run() {
  const base = 'https://ops.betech.co.ke'
  const loginPage = `${base}/attendant/login`
  const creds = { username: 'justus@betech.co.ke', password: 'justus@#2020' }
  const period = '2025-11-25:2025-12-24'

  const out = {}
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(loginPage, { waitUntil: 'networkidle', timeout: 30000 })

    // discover email/username input
    const emailSelectors = [
      'input[name="email"]',
      'input[name="username"]',
      'input[type="email"]',
      'input[placeholder*="email"]',
      'input[type="text"]'
    ]
    const passwordSelectors = ['input[type="password"]', 'input[name="password"]']

    let emailSel = null
    for (const s of emailSelectors) {
      if (await page.$(s)) { emailSel = s; break }
    }
    let passSel = null
    for (const s of passwordSelectors) {
      if (await page.$(s)) { passSel = s; break }
    }

    if (!emailSel || !passSel) {
      console.warn('Could not find conventional input selectors; attempting to fill first inputs')
      const inputs = await page.$$('input')
      if (inputs.length >= 2) {
        await inputs[0].fill(creds.username)
        await inputs[1].fill(creds.password)
      }
    } else {
      await page.fill(emailSel, creds.username)
      await page.fill(passSel, creds.password)
    }

    // try submit
    const submitSelectors = ['button[type="submit"]', 'button:has-text("Sign in")', 'button:has-text("Sign In")', 'button:has-text("Log in")', 'button:has-text("Login")']
    let clicked = false
    for (const s of submitSelectors) {
      const el = await page.$(s)
      if (el) { await Promise.all([el.click(), page.waitForTimeout(1500)]); clicked = true; break }
    }
    if (!clicked) {
      // press Enter in password field
      if (passSel && await page.$(passSel)) {
        await page.press(passSel, 'Enter')
      }
    }

    // wait a bit for client-side navigation
    await page.waitForTimeout(3000)

    // capture cookies and localStorage
    out.cookies = await context.cookies()
    out.localStorage = await page.evaluate(() => ({ ...window.localStorage }))
    out.url = page.url()

    // fetch protected endpoints via page context (cookies included)
    const fetchEndpoint = async (urlPath) => {
      return await page.evaluate(async (p) => {
        try {
          const r = await fetch(p)
          const text = await r.text()
          return { status: r.status, body: text }
        } catch (e) { return { error: String(e) } }
      }, urlPath)
    }

    const earnings = await fetchEndpoint(`/api/marketing/earnings/summary?periodKey=${encodeURIComponent(period)}`)
    const report = await fetchEndpoint(`/api/marketing/report/summary?periodKey=${encodeURIComponent(period)}`)
    const stats = await fetchEndpoint('/api/stats/today')
    const support = await fetchEndpoint(`/api/support/receipts?attendantId=cmiqttmf10000v55sw48jeawd&periodKey=${encodeURIComponent(period)}`)

    out.earnings = earnings
    out.report = report
    out.stats = stats
    out.support = support

    // write to files
    const outDir = path.resolve(__dirname, '..', 'tmp', 'headless-login')
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(out, null, 2))

    console.log('SUCCESS: wrote', path.join(outDir, 'result.json'))
  } catch (err) {
    console.error('ERROR:', err && err.message ? err.message : err)
  } finally {
    await browser.close()
  }
}

run().catch(e => { console.error(e); process.exit(1) })
