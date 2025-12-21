export default function renderReceiptTemplate(snapshot: any, opts: { hideStamp?: boolean } = {}) {
  const branding = snapshot.branding || {};
  const siteTitle = branding.siteTitle || process.env.RECEIPT_SITE_TITLE || 'BETECH SOLAR SOLUTIONS';
  const brandColor = branding.brandColor || '#7A2020';
  const isHttp = (value: any) => typeof value === 'string' && /^https?:\/\//.test(value);
  const letterheadUrl =
    branding.letterheadUrl && isHttp(branding.letterheadUrl)
      ? branding.letterheadUrl
      : (process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || '');
  const logoUrl =
    branding.logoUrl && isHttp(branding.logoUrl)
      ? branding.logoUrl
      : (process.env.NEXT_PUBLIC_RECEIPT_LOGO_URL || '/logo.png');
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
  const phoneNumber = snapshot.phone || snapshot.customerPhone || order?.customerPhone || '';

  const toNumberOrNull = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const fallbackNumber = (...values: Array<number | null | undefined>) => {
    for (const value of values) {
      if (value !== null && value !== undefined) return value;
    }
    return null;
  };
  const formatAmount = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  };

  const itemsSubtotal = items.reduce((sum, it) => {
    const qty = toNumberOrNull(it.quantity) ?? 1;
    const unit = toNumberOrNull(it.unitPrice ?? it.sellingPrice) ?? 0;
    return sum + qty * unit;
  }, 0);
  const subtotalCandidate = fallbackNumber(
    toNumberOrNull(totals.subtotal),
    toNumberOrNull(snapshot.subtotal),
    toNumberOrNull(snapshot.subtotalAmount)
  );
  const subtotalValue = subtotalCandidate ?? itemsSubtotal;

  const taxCandidate = fallbackNumber(
    toNumberOrNull(totals.tax),
    toNumberOrNull(snapshot.taxAmount),
    toNumberOrNull(snapshot.tax)
  );
  const taxValue = taxCandidate ?? 0;

  const totalCandidate = fallbackNumber(
    toNumberOrNull(totals.total),
    toNumberOrNull(snapshot.total),
    toNumberOrNull(snapshot.totalAmount),
    toNumberOrNull(order?.totalAmount),
    subtotalValue + taxValue
  );
  const totalValue = totalCandidate ?? subtotalValue + taxValue;
  const balanceValue = fallbackNumber(
    toNumberOrNull(totals.balance),
    toNumberOrNull(snapshot.balance),
    totalValue
  );

  const itemsHtml = items
    .map((it: any) => {
      const qty = Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1;
      const unit = Number.isFinite(Number(it.unitPrice ?? it.sellingPrice)) ? Number(it.unitPrice ?? it.sellingPrice) : 0;
      const lineTotal = qty * unit;
      const unitText = formatAmount(unit) || '';
      const lineTotalText = formatAmount(lineTotal) || '';
      const title = it.title || it.productName || '';
      return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${qty}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${title}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${unitText}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${lineTotalText}</td>
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

      /* A5-optimized footer styles (compact, single-column, low-ink) */
      .receipt-footer {
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px dashed rgba(0, 0, 0, 0.35);
        font-size: 11.5px;
        line-height: 1.45;
        color: #000;
      }

      .receipt-footer p { margin: 0 0 6px; }

      .footer-title { font-weight: 700; font-size: 12px; margin-bottom: 4px; }

      .social-list { margin: 6px 0 8px; padding-left: 0; list-style: none; }
      .social-list li { margin: 2px 0; }
      .social-list a { color: #000; text-decoration: underline; word-break: break-word; }

      .footer-divider { margin: 8px 0; border-top: 1px solid rgba(0, 0, 0, 0.25); }
      .footer-muted { font-size: 11px; }
      .hashtag-link { font-weight: 700; color: #000; text-decoration: underline; }

      @media print { .receipt-footer { page-break-inside: avoid; } }
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
        <div><strong>Phone:</strong> ${phoneNumber || '-'}</div>
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
      <tr><td></td><td class="right">Subtotal:</td><td class="right">${formatAmount(subtotalValue)}</td></tr>
      ${snapshot.showDiscount ? `<tr><td></td><td class="right">Discount:</td><td class="right">${formatAmount(toNumberOrNull(snapshot.discount) ?? toNumberOrNull(totals.discount))}</td></tr>` : ''}
      <tr><td></td><td class="right"><strong>Total:</strong></td><td class="right"><strong>${formatAmount(totalValue)}</strong></td></tr>
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

      <div class="receipt-footer">
        <p class="footer-title">Connect With Us</p>
        <p class="footer-muted">Follow, review &amp; see our latest solar projects:</p>
        <ul class="social-list">
          <li>Facebook: <a href="https://web.facebook.com/p/Betech-Solar-Solutions-Kenya-61567374346730/" target="_blank" rel="noopener noreferrer">Betech Solar Solutions Kenya</a></li>
          <li>Instagram: <a href="https://www.instagram.com/betechsolarsolutionskenya/" target="_blank" rel="noopener noreferrer">@betechsolarsolutionskenya</a></li>
          <li>TikTok: <a href="https://www.tiktok.com/@betechsolarsolutionske" target="_blank" rel="noopener noreferrer">@betechsolarsolutionske</a></li>
        </ul>
        <div class="footer-divider"></div>
        <p>Thank you for choosing <strong>Betech Solar Solutions</strong>.</p>
        <p class="footer-muted">View our recent solar installations: <a class="hashtag-link" href="https://www.tiktok.com/tag/betechprojects" target="_blank" rel="noopener noreferrer">#BetechProjects</a></p>
      </div>

    </div>
  </body>
  </html>
  `;
}
