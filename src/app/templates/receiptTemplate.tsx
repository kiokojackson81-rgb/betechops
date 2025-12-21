export default function renderReceiptTemplate(snapshot: any, opts: { hideStamp?: boolean } = {}) {
  const branding = snapshot.branding || {};
  const siteTitle = branding.siteTitle || process.env.RECEIPT_SITE_TITLE || 'BETECH SOLAR SOLUTIONS';
  const brandColor = branding.brandColor || '#7A2020';
  const isHttp = (value: any) => typeof value === 'string' && /^https?:\/\//.test(value);
  const letterheadUrl = isHttp(branding.letterheadUrl)
    ? branding.letterheadUrl
    : isHttp(process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL ?? '')
    ? process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL!
    : '';
  const logoUrl = isHttp(branding.logoUrl)
    ? branding.logoUrl
    : isHttp(process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL ?? '')
    ? process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL!
    : '/logo.png';
  const headerImg = letterheadUrl || logoUrl;

  // Only render an <img> header when we have a header image. Otherwise leave
  // the header empty so the printed receipt shows just the page content.
  const headerHtml = headerImg
    ? `<img src="${headerImg}" alt="branding" style="width:100%;border-radius:8px;margin-bottom:12px;object-fit:cover;" />`
    : '';
  const order = snapshot.order || {};
  const items = snapshot.items || order.items || [];
  const totals = snapshot.totals || order.totals || {};
  const notes = snapshot.notes || '';
  const attendant = order?.attendant?.name || snapshot.attendantName || snapshot.issuedByName || '';
  const paymentMethod = snapshot.paymentMethod || order?.paymentMethod || '';
  const deliveryAddress = snapshot.deliveryAddress || order?.deliveryAddress || '';

  const itemsHtml = items
    .map((it: any) => {
      const qty = Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1;
      const unit = Number.isFinite(Number(it.unitPrice ?? it.sellingPrice)) ? Number(it.unitPrice ?? it.sellingPrice) : 0;
      const lineTotal = (qty * unit) || '';
      const title = it.title || it.productName || '';
      return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${qty}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${title}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${unit || ''}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${lineTotal}</td>
      </tr>`;
    })
    .join('');

  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${siteTitle} Receipt ${order.orderNumber || ''}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
      .page { max-width: 760px; margin: 0 auto; padding: 18px; border:1px solid #cbd5e1; border-radius:8px }
      header { text-align:center; margin-bottom:12px; }
      .meta { display:flex; justify-content:space-between; margin:12px 0 }
      table { width:100%; border-collapse: collapse; margin-top:8px }
      th { text-align:left; padding:8px; border-bottom:2px solid #e5e7eb; color:${brandColor}; }
      td { padding:8px }
      .right { text-align:right }
      .totals { width:100%; margin-top:12px }
      .totals td { border:none; padding:6px; color:${brandColor}; }
      .totals strong { color:${brandColor}; }
      .notes { margin-top:14px; padding:10px; background:#f8fafc; border-radius:6px }
      .signature { margin-top:20px; text-align:center }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        ${headerHtml}
      </header>

      <div class="meta">
        <div>
          <div><strong>Date:</strong> ${new Date(snapshot.generatedAt || Date.now()).toLocaleString()}</div>
          <div><strong>M/S:</strong> ${snapshot.customerName || order?.customerName || ''}</div>
        </div>
        <div class="right">
          <div><strong>Receipt No.</strong> ${order.orderNumber || snapshot.serial || ''}</div>
          <div style="margin-top:6px"><strong>Address :</strong> ${deliveryAddress || '-'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr><th>Qty</th><th>Particulars</th><th class="right">@ (Ksh)</th><th class="right">Kshs.</th></tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <table class="totals">
        <tr><td></td><td class="right">Subtotal:</td><td class="right">${totals.subtotal ?? ''}</td></tr>
        <tr><td></td><td class="right"><strong>Total:</strong></td><td class="right"><strong>${totals.total ?? ''}</strong></td></tr>
      </table>

      <div style="margin-top:10px">
        <div><strong>Payment method:</strong> ${paymentMethod}</div>
        ${deliveryAddress ? `<div><strong>Deliver to:</strong> ${deliveryAddress}</div>` : ''}
      </div>

      ${notes ? `<div class="notes"><strong>Notes:</strong><div style="margin-top:6px">${notes}</div></div>` : ''}

      <div class="signature">
        <p>Thank you for shopping with Betech Solar Solutions.</p>
        <p>You were served by ${attendant || '____'}.</p>
        <p>Goods once sold cannot be refunded.</p>
        ${opts.hideStamp ? '' : '<div style="margin-top:18px">______________________________</div>'}
      </div>

      <div style="margin-top:18px;border-top:1px dashed #e5e7eb;padding-top:12px;font-size:13px;color:#111827">
        <div style="font-weight:700;margin-bottom:6px">Thank you for shopping with Betech Solar Solutions.</div>
        <div style="margin-bottom:6px">
          Share your experience and explore our recent solar projects on social media using <strong>#BetechProjects</strong>.
        </div>
        <div style="margin-bottom:6px;color:#374151">Stay connected: info@betech.co.ke | 0703 241 917</div>
        <div style="font-weight:600;color:${brandColor};">We deliver solar excellence coast to coast.</div>
      </div>

    </div>
  </body>
  </html>
  `;
}
