export default function renderReceiptTemplate(
  snapshot: any,
  opts: { hideStamp?: boolean; hideItemWarrantySummary?: boolean } = {}
) {
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
  const formatWarrantyValue = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    try {
      if (typeof value === 'object') return JSON.stringify(value);
    } catch {
      // ignore
    }
    return String(value);
  };
  const itemWarrantyEntries = opts.hideItemWarrantySummary
    ? ''
    : items
        .filter((it: any) => (it.serial && String(it.serial).trim()) || (it.warranty && String(it.warranty).trim()))
        .map((it: any) => {
          const parts: string[] = [];
          if (it.serial) {
            parts.push(`SN ${String(it.serial).trim()}`);
          }
          const warrantyValue = formatWarrantyValue(it.warranty);
          if (warrantyValue) {
            parts.push(`Warranty: ${warrantyValue}`);
          }
          const label = it.title || it.productName || 'Item';
          return `<div class="item-warranty-row"><strong>${label}</strong>: ${parts.join(' | ')}</div>`;
        })
        .join('');
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
      const itemMeta: string[] = [];
      if (it.serial) {
        itemMeta.push(`Serial / IMEI: ${String(it.serial)}`);
      }
      if (it.warranty) {
        itemMeta.push(`Warranty: ${String(it.warranty)}`);
      }
      const itemMetaHtml = itemMeta.length
        ? `<div class="item-meta">${itemMeta.map((m) => `<span>${m}</span>`).join(' | ')}</div>`
        : '';
      return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${qty}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">
          ${title}
          ${itemMetaHtml}
        </td>
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
        :root { --brandColor: ${brandColor}; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
      .page { max-width: 760px; margin: 0 auto; padding: 18px; background: #fff; border: none; box-shadow: 0 18px 35px rgba(15, 23, 42, 0.12); }
      /* Print layout: force A5, prevent unwanted page breaks and keep footer on same page */
      @page { size: A5 portrait; margin: 6mm; }
      @media print {
        html, body {
          width: 148mm;
          height: 210mm;
          margin: 0;
          padding: 0;
          font-size: 10px;
          line-height: 1.1;
          word-break: keep-all;
          hyphens: none;
        }
        body {
          min-height: 210mm;
          overflow: hidden;
        }
        .page {
          box-sizing: border-box;
          width: 100%;
          height: 100%;
          max-height: calc(210mm - 12mm);
          display: flex;
          flex-direction: column;
          padding: 6mm;
          margin: 0;
          box-shadow: none;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        /* Keep header and footer from breaking */
        header { flex: 0 0 auto; }
        .signature { flex: 0 0 auto; }
        .receipt-footer {
          flex: 0 0 auto;
          page-break-inside: avoid;
          break-inside: avoid;
          margin-top: 10px;
          font-size: 10px;
        }
        .receipt-footer-container {
          margin-top: auto;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .meta, table, .item-warranty, .notes {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        table {
          page-break-after: auto;
        }
        tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        th, td {
          padding: 5px 6px;
        }
        .meta {
          flex-wrap: wrap;
          gap: 4px;
        }
        .receipt-footer {
          margin-top: 10px;
        }
        .social-row {
          gap: 4px;
        }
        .social-link {
          font-size: 10px;
        }
        .footer-divider {
          margin: 6px auto;
          width: 85%;
        }
        body, .page { font-size: 10px; }
        /* Ensure colors print accurately */
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
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

      .item-warranty-row {
        font-size: 11px;
        color: #1f2937;
        margin-bottom: 4px;
      }
      .item-warranty {
        margin-top: 10px;
        border-top: 1px dashed rgba(15, 23, 42, 0.1);
        padding-top: 8px;
      }
      .item-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
        font-size: 10px;
        color: rgba(15, 23, 42, 0.8);
      }
      .item-meta span {
        background: #f2f6ff;
        border-radius: 4px;
        padding: 2px 6px;
        border: 1px solid rgba(15, 23, 42, 0.15);
      }

      .receipt-footer {
        margin-top: 14px;
        padding-top: 10px;
        border-top: 1px dashed rgba(0, 0, 0, 0.35);
        text-align: center;
        font-size: 11.5px;
        line-height: 1.45;
        color: #111;
      }

      /* Ensure the footer container stays on the same printed page */
      .receipt-footer-container {
        margin-top: auto;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .footer-badge {
        display: inline-block;
        padding: 4px 10px;
        border: 1px solid rgba(0, 0, 0, 0.25);
        border-radius: 999px;
        font-weight: 700;
        font-size: 11.5px;
        letter-spacing: 0.2px;
        margin-bottom: 6px;
        color: var(--brandColor);
      }

      .footer-subtitle {
        margin: 0 0 8px;
      }

      .footer-muted {
        margin: 0;
        font-size: 11.5px;
      }

      .social-row {
        display: inline-flex;
        flex-direction: column;
        gap: 6px;
        align-items: center;
        margin: 0 0 10px;
      }

      .social-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #111;
        text-decoration: underline;
        font-weight: 600;
      }

      .social-link span {
        font-weight: 700;
      }

      .ico {
        width: 14px;
        height: 14px;
        flex: 0 0 14px;
      }

      .footer-divider {
        margin: 10px auto;
        width: 70%;
        border-top: 1px solid rgba(0, 0, 0, 0.2);
      }

      .footer-strong {
        margin: 0 0 2px;
        font-weight: 800;
      }

      .hashtag-link {
        font-weight: 800;
        text-decoration: underline;
        color: var(--brandColor);
      }

      @media print {
        .receipt-footer {
          page-break-inside: avoid;
        }
      }
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

      ${itemWarrantyEntries ? `<div class="item-warranty">${itemWarrantyEntries}</div>` : ''}

      ${notes ? `<div class="notes"><strong>Notes:</strong><div style="margin-top:6px">${notes}</div></div>` : ''}

      <div class="signature">
        <p>You were served by ${attendant || '____'}.</p>
        <p>Goods once sold cannot be refunded.</p>
      </div>

      <div class="receipt-footer-container">
      <div class="receipt-footer">
        <div class="footer-badge">Connect With Us</div>
        <p class="footer-muted footer-subtitle">Follow &amp; see our latest solar projects:</p>

        <div class="social-row">
          <a class="social-link"
             href="https://web.facebook.com/p/Betech-Solar-Solutions-Kenya-61567374346730/"
             target="_blank" rel="noopener noreferrer">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13.5 22v-8h2.7l.4-3H13.5V9.1c0-.9.2-1.5 1.6-1.5H16.8V5.1c-.3 0-1.4-.1-2.7-.1-2.7 0-4.6 1.6-4.6 4.7V11H7v3h2.5v8h4z" fill="currentColor"/>
            </svg>
            <span>Facebook:</span> Betech Solar Solutions Kenya
          </a>

          <a class="social-link"
             href="https://www.instagram.com/betechsolarsolutionskenya/"
             target="_blank" rel="noopener noreferrer">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm5.2-.9a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" fill="currentColor"/>
            </svg>
            <span>Instagram:</span> @betechsolarsolutionskenya
          </a>

          <a class="social-link"
             href="https://www.tiktok.com/@betechsolarsolutionske"
             target="_blank" rel="noopener noreferrer">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 3c.4 3 2.6 5.5 6 5.8v3c-2.2 0-4.2-.8-6-2.2V16a6 6 0 1 1-6-6c.3 0 .7 0 1 .1v3.2a3 3 0 1 0 2 2.8V3h3z" fill="currentColor"/>
            </svg>
            <span>TikTok:</span> @betechsolarsolutionske
          </a>
        </div>

        <div class="footer-divider"></div>

        <p class="footer-strong">Thank you for choosing Betech Solar Solutions.</p>
        <p class="footer-muted">
          View our recent installations:
          <a class="hashtag-link"
             href="https://www.tiktok.com/tag/betechprojects"
             target="_blank" rel="noopener noreferrer">#BetechProjects</a>
        </p>
      </div>
      </div>

    </div>
  </body>
  </html>
  `;
}
