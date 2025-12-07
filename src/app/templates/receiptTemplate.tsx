export default function renderReceiptTemplate(snapshot: any) {
  const siteTitle = process.env.RECEIPT_SITE_TITLE || 'Betech Ops';
  const logo = process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png';
  const order = snapshot.order || {};
  const items = snapshot.items || order.items || [];
  const totals = snapshot.totals || order.totals || {};

  const itemsHtml = items.map((it: any) => `<tr><td>${(it.title||it.productName||'')}</td><td style="text-align:right">${it.quantity||1}</td><td style="text-align:right">${it.unitPrice||it.sellingPrice||''}</td><td>${it.serial||''}</td><td>${it.warranty||''}</td></tr>`).join('');

  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Receipt ${order.orderNumber||''}</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; color: #0f172a; }
      .container { max-width: 800px; margin: 0 auto; padding: 20px; }
      header { display:flex; align-items:center; gap:12px; }
      header img { height:48px }
      h1 { margin:0; font-size:18px }
      table { width:100%; border-collapse: collapse; margin-top:12px }
      th, td { border:1px solid #e6edf3; padding:8px; }
      th { background:#f8fafc; text-align:left }
      .right { text-align:right }
      .totals { margin-top:12px; width:100% }
      .totals td { border:none; padding:6px }
      .signature { margin-top:28px; }
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <img src="${logo}" alt="${siteTitle}" />
        <div>
          <h1>${siteTitle}</h1>
          <div>Receipt: ${order.orderNumber||''}</div>
          <div>Date: ${new Date(snapshot.generatedAt||Date.now()).toLocaleString()}</div>
        </div>
      </header>

      <section>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Serial</th><th>Warranty</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <table class="totals">
          <tr><td class="right">Subtotal</td><td class="right">${totals.subtotal||''}</td></tr>
          <tr><td class="right">Tax</td><td class="right">${totals.tax||''}</td></tr>
          <tr><td class="right"><strong>Total</strong></td><td class="right"><strong>${totals.total||''}</strong></td></tr>
        </table>

        <div class="signature">
          <div>_______________________</div>
          <div>Authorized signature</div>
        </div>
      </section>
    </div>
  </body>
  </html>
  `;
}
