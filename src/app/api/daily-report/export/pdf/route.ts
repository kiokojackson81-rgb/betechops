import { NextResponse } from 'next/server';

// Server-side PDF generation route (scaffold).
// Notes:
// - This route attempts to use `puppeteer` to render a PDF from HTML.
// - It expects an environment variable `NEXT_PUBLIC_BASE_URL` (e.g. https://ops.betech.co.ke)
//   so it can call the `/api/daily-report` listing endpoint with the same query params.
// - If `puppeteer` is not installed or available, it returns 501 with instructions.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();

  // Fetch the same data the admin UI would receive
  const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
  const apiUrl = `${base}/api/daily-report${qs ? `?${qs}` : ''}`;
  const resp = await fetch(apiUrl, { method: 'GET' });
  if (!resp.ok) return NextResponse.json({ error: 'Failed to fetch reports from API' }, { status: 500 });
  const data = await resp.json();

  let puppeteer: any;
  try {
    // dynamic import so route still works if puppeteer is not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    puppeteer = require('puppeteer');
  } catch (err) {
    return NextResponse.json({ error: 'Server-side PDF generation requires `puppeteer`. Install it or use client-side print.' }, { status: 501 });
  }

  const reports = data.reports || [];

  const rows = reports.map((r: any) => {
    const dateStr = new Date(r.date).toISOString().split('T')[0];
    const attendant = r.user?.name ?? '';
    const products = r.tasks?.categories ?? {};
    const sales = Array.isArray(r.tasks?.sales) ? r.tasks.sales : [];
    return `<tr>
      <td style="padding:6px;border:1px solid #ddd">${dateStr}</td>
      <td style="padding:6px;border:1px solid #ddd">${r.day}</td>
      <td style="padding:6px;border:1px solid #ddd">${attendant}</td>
      <td style="padding:6px;border:1px solid #ddd">${r.tasks?.submittedBy ?? ''}</td>
      <td style="padding:6px;border:1px solid #ddd">${products.newUploads ?? ''}</td>
      <td style="padding:6px;border:1px solid #ddd">${products.copiesUploaded ?? ''}</td>
      <td style="padding:6px;border:1px solid #ddd">${products.productsEdited ?? ''}</td>
      <td style="padding:6px;border:1px solid #ddd">${sales.length}</td>
    </tr>`;
  }).join('');

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Daily Reports PDF</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color:#111; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; }
          th { background: #f4f4f4; }
        </style>
      </head>
      <body>
        <h1>Daily Reports Export</h1>
        <table>
          <thead>
            <tr><th>Date</th><th>Day</th><th>Attendant</th><th>SubmittedBy</th><th>NewUploads</th><th>Copies</th><th>Edited</th><th>SalesCount</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>`;

  // Launch puppeteer and render PDF
  let browser: any;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return new NextResponse(pdfBuffer, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="daily_reports.pdf"' } });
  } catch (err: any) {
    if (browser) await browser.close();
    return NextResponse.json({ error: 'Failed to generate PDF', detail: String(err) }, { status: 500 });
  }
}
