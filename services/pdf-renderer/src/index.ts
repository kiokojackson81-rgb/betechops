import express from 'express';
import bodyParser from 'body-parser';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));

app.post('/render', async (req, res) => {
  const { html } = req.body || {};
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Missing html body' });
  }

  try {
    const launchOptions: any = {
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process'],
      defaultViewport: (chromium as any).defaultViewport,
      headless: (chromium as any).headless,
      executablePath: await chromium.executablePath(),
    };

    const browser = await puppeteer.launch(launchOptions);
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(pdf.length));
      return res.status(200).send(pdf);
    } finally {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    console.error('[pdf-renderer] failed to render PDF', err);
    return res.status(500).json({ error: 'Failed to render PDF' });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => console.log(`[pdf-renderer] listening on ${port}`));
