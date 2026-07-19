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
    ? `<img src="${headerImg}" alt="branding" style="display:block;width:100%;max-height:34mm;object-fit:contain;object-position:top center;margin:0;" />`
    : '';
  const order = snapshot.order || {};
  const items = snapshot.items || order.items || [];
  const totals = snapshot.totals || order.totals || {};
  const notes = snapshot.notes || '';
  const attendant = (snapshot.attendantName && String(snapshot.attendantName).trim()) || (order?.attendant?.name && String(order.attendant.name).trim()) || (snapshot.issuedByName && String(snapshot.issuedByName).trim()) || '';
  const paymentMethod = snapshot.paymentMethod || order?.paymentMethod || '';
  const deliveryAddress = snapshot.deliveryAddress || order?.deliveryAddress || '';
  const customerEmail = snapshot.customerEmail || order?.customerEmail || '';
  const projectFlow =
    snapshot.projectFlow && typeof snapshot.projectFlow === 'object' ? snapshot.projectFlow : null;
  const quotePaymentMethod = snapshot.quotePaymentMethod || null;
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
  const allowMarketingFooter = (items.length || 0) <= 5;
  const isCompactReceipt = (items.length || 0) <= 5 && !notes && !itemWarrantyEntries;

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
  const formatProjectPaymentTerm = (value: unknown) => {
    switch (String(value || '').trim().toUpperCase()) {
      case 'FULL_BEFORE_INSTALLATION':
        return 'Pay fully before installation';
      case 'DEPOSIT_AND_BALANCE':
        return 'Deposit and balance';
      case 'FULL_AFTER_INSTALLATION':
        return 'Pay fully after installation';
      default:
        return 'Project payment flow';
    }
  };
  const formatProjectPaymentStatus = (value: unknown) => {
    switch (String(value || '').trim().toUpperCase()) {
      case 'FULLY_PAID':
        return 'Fully paid';
      case 'PARTIALLY_PAID':
        return 'Partially paid';
      default:
        return 'Unpaid';
    }
  };
  const formatProjectPaymentMethod = (value: unknown) => {
    switch (String(value || '').trim().toUpperCase()) {
      case 'MPESA_PAYBILL':
        return 'M-Pesa Paybill';
      case 'ABSA_BANK':
        return 'Absa Bank';
      case 'EQUITY_BANK':
        return 'Equity Bank';
      case 'MPESA':
        return 'M-Pesa';
      case 'CASH':
        return 'Cash';
      case 'BANK':
        return 'Bank';
      case 'MIXED':
        return 'Mixed';
      default:
        return 'Unspecified';
    }
  };
  const fallbackCollectionMethodsHtml = `
    <div class="project-payment-method-list">
      <div class="project-payment-method-option">
        <div class="project-payment-method-title">M-Pesa Paybill</div>
        <div class="project-payment-method-line"><span>Paybill Number:</span> <strong>516600</strong></div>
        <div class="project-payment-method-line"><span>Account Number:</span> <strong>0710098001</strong></div>
      </div>
      <div class="project-payment-method-option">
        <div class="project-payment-method-title">ABSA Bank</div>
        <div class="project-payment-method-line"><span>Bank:</span> Absa Bank Kenya</div>
        <div class="project-payment-method-line"><span>Account Name:</span> Betech Solar Solution</div>
        <div class="project-payment-method-line"><span>Account Number:</span> <strong>2047639940</strong></div>
      </div>
    </div>
  `;

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
  const projectPaymentSummaryHtml =
    projectFlow?.isProject
      ? `
      <div class="project-payment-summary">
        <div class="project-payment-summary__header">
          <div class="project-payment-summary__title">Project payment summary</div>
          <div class="project-payment-summary__badge">${formatProjectPaymentStatus(projectFlow.paymentStatus)}</div>
        </div>
        <div class="project-payment-summary__grid">
          <div class="project-payment-summary__item">
            <span>Payment plan</span>
            <strong>${formatProjectPaymentTerm(projectFlow.paymentTerm)}</strong>
          </div>
          <div class="project-payment-summary__item">
            <span>Paid so far</span>
            <strong>KES ${formatAmount(toNumberOrNull(projectFlow.totalPaidAmount) ?? 0)}</strong>
          </div>
          <div class="project-payment-summary__item">
            <span>Remaining balance</span>
            <strong>KES ${formatAmount(toNumberOrNull(projectFlow.remainingAmount) ?? 0)}</strong>
          </div>
          ${
            String(projectFlow.paymentTerm || '').trim().toUpperCase() === 'DEPOSIT_AND_BALANCE'
              ? `
              <div class="project-payment-summary__item">
                <span>Deposit</span>
                <strong>KES ${formatAmount(toNumberOrNull(projectFlow.depositPaidAmount) ?? 0)} / ${formatAmount(toNumberOrNull(projectFlow.depositRequiredAmount) ?? 0)}</strong>
              </div>
              <div class="project-payment-summary__item">
                <span>Deposit method</span>
                <strong>${formatProjectPaymentMethod(projectFlow.depositPaymentMethod)}</strong>
              </div>
              <div class="project-payment-summary__item">
                <span>Balance after installation</span>
                <strong>KES ${formatAmount(toNumberOrNull(projectFlow.balancePendingAmount) ?? 0)}</strong>
              </div>
              <div class="project-payment-summary__item">
                <span>Balance method</span>
                <strong>${formatProjectPaymentMethod(projectFlow.balancePaymentMethod)}</strong>
              </div>`
              : `
              <div class="project-payment-summary__item project-payment-summary__item--methods">
                <span>Collection method</span>
                ${
                  formatProjectPaymentMethod(
                    (
                      String(projectFlow.paymentTerm || '').trim().toUpperCase() === 'FULL_BEFORE_INSTALLATION'
                        ? projectFlow.depositPaymentMethod
                        : projectFlow.balancePaymentMethod
                    ) || quotePaymentMethod,
                  ) === 'Unspecified'
                    ? fallbackCollectionMethodsHtml
                    : `<strong>${formatProjectPaymentMethod(
                        (
                          String(projectFlow.paymentTerm || '').trim().toUpperCase() === 'FULL_BEFORE_INSTALLATION'
                            ? projectFlow.depositPaymentMethod
                            : projectFlow.balancePaymentMethod
                        ) || quotePaymentMethod,
                      )}</strong>`
                }
              </div>
              <div class="project-payment-summary__item">
                <span>Expected payment</span>
                <strong>KES ${formatAmount(
                  String(projectFlow.paymentTerm || '').trim().toUpperCase() === 'FULL_BEFORE_INSTALLATION'
                    ? toNumberOrNull(projectFlow.depositRequiredAmount) ?? 0
                    : toNumberOrNull(projectFlow.balanceExpectedAmount) ?? 0,
                )}</strong>
              </div>`
          }
        </div>
      </div>`
      : '';

  const itemsHtml = items
    .map((it: any, index: number) => {
      const qty = Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1;
      const unit = Number.isFinite(Number(it.unitPrice ?? it.sellingPrice)) ? Number(it.unitPrice ?? it.sellingPrice) : 0;
      const lineTotal = qty * unit;
      const unitText = formatAmount(unit) || '';
      const lineTotalText = formatAmount(lineTotal) || '';
      const title = it.title || it.productName || 'Item';
      const itemMeta: string[] = [];
      if (it.serial) {
        itemMeta.push(`Serial / IMEI: ${String(it.serial)}`);
      }
      if (it.warranty) {
        itemMeta.push(`Warranty: ${String(it.warranty)}`);
      }
      return `
      <tbody class="receipt-item-block${index ? ' receipt-item-block--spaced' : ''}">
        <tr class="product-name-row">
          <td colspan="3">
            <div class="product-name-label">Item name</div>
            <div class="product-name-value">${title}</div>
            ${
              itemMeta.length
                ? `<div class="item-meta">${itemMeta.map((m) => `<span>${m}</span>`).join('')}</div>`
                : ''
            }
          </td>
        </tr>
        <tr class="pricing-header">
          <th>Quantity</th>
          <th class="right">Unit price</th>
          <th class="right">Total</th>
        </tr>
        <tr class="pricing-values">
          <td>${qty}</td>
          <td class="right">${unitText}</td>
          <td class="right total-value">${lineTotalText}</td>
        </tr>
      </tbody>`;
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
        @page { size: A5 portrait; margin: 2mm; }
        html, body {
          margin: 0;
          padding: 0;
          color: #111827;
          background: #f3f4f6;
          font-family: "Segoe UI", Arial, Helvetica, sans-serif;
        }
        body { padding: 4px; }
        .page {
          box-sizing: border-box;
          width: calc(148mm - 4mm);
          min-height: calc(210mm - 4mm);
          height: calc(210mm - 4mm);
          margin: 0 auto;
          padding: 2.5mm 3.5mm 3mm;
          background: #fff;
          border: 1px solid #d1d5db;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          overflow: hidden;
        }
        .receipt-body {
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          height: 100%;
          min-height: 0;
        }
        .receipt-bottom {
          margin-top: auto;
          padding-top: 8px;
        }
        header {
          text-align: center;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid #e5e7eb;
        }
        header img {
          display: block;
          width: 100%;
          max-height: 34mm;
          object-fit: contain;
          object-position: top center;
        }
        .meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 6px 0 10px;
          font-size: 12px;
        }
        .meta > div {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px 10px;
          background: #fafafa;
          line-height: 1.45;
        }
        table { width:100%; border-collapse: collapse; margin-top:8px; font-size: 12px; }
        th {
          text-align:left;
          padding:8px;
          border-top:1px solid #d1d5db;
          border-bottom:1px solid #d1d5db;
          background: #f8fafc;
          color:${brandColor};
          font-weight: 700;
          letter-spacing: 0.2px;
        }
        td { padding:8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
        .right { text-align:right }
        .items-table {
          margin-top: 8px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }
        .items-table th,
        .items-table td {
          border: none;
        }
        .receipt-item-block--spaced .product-name-row td {
          border-top: 1px solid #e5e7eb;
        }
        .product-name-row td {
          padding: 10px 10px 8px;
          background: #fffdf8;
          white-space: normal;
          word-break: break-word;
        }
        .product-name-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${brandColor};
        }
        .product-name-value {
          margin-top: 3px;
          font-size: 12.5px;
          line-height: 1.45;
          font-weight: 700;
          color: #111827;
        }
        .pricing-header th {
          padding: 6px 10px;
          background: #f8fafc;
          text-align: center;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${brandColor};
        }
        .pricing-header th.right {
          text-align: right;
        }
        .pricing-values td {
          padding: 7px 10px 9px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #1f2937;
        }
        .pricing-values td:first-child {
          text-align: center;
        }
        .pricing-values .total-value {
          font-weight: 800;
          color: #111827;
        }
        .totals {
          width: 56%;
          margin: 10px 0 0 auto;
          border-collapse: collapse;
          font-size: 12px;
        }
        .totals td {
          border: none;
          padding: 5px 0;
          color: #1f2937;
        }
        .totals .total-row td {
          border-top: 1px solid #d1d5db;
          padding-top: 7px;
          font-size: 13px;
          color: ${brandColor};
        }
        .notes {
          margin-top: 10px;
          padding: 10px;
          background:#f8fafc;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          font-size: 11.5px;
          line-height: 1.5;
        }
      .signature {
        margin-top: 12px;
        text-align:center;
        font-size: 11.5px;
        line-height: 1.45;
      }

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
        margin-top: 5px;
        font-size: 10px;
        color: rgba(15, 23, 42, 0.8);
      }
        .item-meta span {
          background: #f2f6ff;
          border-radius: 4px;
          padding: 2px 6px;
          border: 1px solid rgba(15, 23, 42, 0.15);
        }
        .project-payment-summary {
          margin: 0 0 10px;
          border: 1px solid #dbeafe;
          border-radius: 10px;
          background: #f8fbff;
          padding: 10px;
        }
        .project-payment-summary__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .project-payment-summary__title {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${brandColor};
        }
        .project-payment-summary__badge {
          border: 1px solid rgba(122, 32, 32, 0.18);
          border-radius: 999px;
          padding: 4px 9px;
          background: rgba(122, 32, 32, 0.06);
          font-size: 10px;
          font-weight: 700;
          color: ${brandColor};
        }
        .project-payment-summary__grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .project-payment-summary__item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
          padding: 8px;
        }
        .project-payment-summary__item span {
          display: block;
          font-size: 10px;
          color: #64748b;
          margin-bottom: 4px;
        }
        .project-payment-summary__item strong {
          display: block;
          font-size: 11.5px;
          color: #0f172a;
        }
        .project-payment-summary__item--methods {
          grid-column: 1 / -1;
        }
        .project-payment-method-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 4px;
        }
        .project-payment-method-option {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fffdf8;
          padding: 7px 8px;
        }
        .project-payment-method-title {
          font-size: 11px;
          font-weight: 800;
          color: ${brandColor};
          margin-bottom: 3px;
        }
        .project-payment-method-line {
          font-size: 10px;
          color: #1f2937;
          line-height: 1.3;
          margin-top: 2px;
        }
        .project-payment-method-line span {
          font-weight: 700;
          color: #475569;
        }

      .receipt-footer {
        margin-top: 0;
        padding-top: 10px;
        border-top: 1px dashed rgba(0, 0, 0, 0.35);
        text-align: center;
        font-size: 11.5px;
        line-height: 1.45;
        color: #111;
      }

      /* Ensure the footer container stays on the same printed page */
      .receipt-footer-container {
        margin-top: 8px;
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
        font-size: 11px;
      }

      .social-row {
        display: inline-flex;
        flex-direction: column;
        gap: 5px;
        align-items: center;
        margin: 0 0 8px;
      }

      .social-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #111;
        text-decoration: underline;
        font-weight: 600;
        font-size: 10.5px;
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
        margin: 8px auto;
        width: 78%;
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
        html, body {
          width: auto;
          min-height: auto;
          margin: 0;
          padding: 0;
          background: #fff;
          font-size: 11px;
          line-height: 1.35;
        }
        body { overflow: visible; }
        .page {
          width: calc(148mm - 4mm);
          height: calc(210mm - 4mm);
          min-height: calc(210mm - 4mm);
          max-height: none;
          margin: 0;
          padding: 2mm 3mm 2.5mm;
          box-shadow: none;
          border: none;
          overflow: visible;
        }
        .receipt-body {
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          height: 100%;
          min-height: 0;
          overflow: visible;
        }
        .receipt-bottom {
          margin-top: auto;
          padding-top: 4px;
        }
        header {
          margin-bottom: 6px;
          padding-bottom: 5px;
        }
        header,
        .signature,
        .receipt-footer,
        .receipt-footer-container,
        .meta,
        .item-warranty,
        .notes,
        tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .meta { font-size: 11px; }
        .meta { margin: 4px 0 6px; gap: 5px; }
        .meta > div { padding: 5px 7px; }
        table { font-size: 11px; }
        th, td { padding: 4px; }
        .items-table { margin-top: 6px; }
        .product-name-row td { padding: 7px 7px 5px; }
        .product-name-label { font-size: 9px; }
        .product-name-value { font-size: 11px; line-height: 1.35; }
        .pricing-header th { padding: 4px 7px; font-size: 8.8px; }
        .pricing-values td { padding: 4px 7px 6px; font-size: 10.2px; }
        .item-meta { gap: 4px; margin-top: 4px; font-size: 9px; }
        .totals { font-size: 11.5px; width: 58%; }
        .totals { margin-top: 5px; }
        .totals td { padding: 2px 0; }
        .notes { margin-top: 5px; padding: 6px; }
        .project-payment-summary { margin-bottom: 6px; padding: 7px; }
        .project-payment-summary__header { margin-bottom: 5px; }
        .project-payment-summary__title { font-size: 9.2px; }
        .project-payment-summary__badge { font-size: 8.8px; padding: 3px 7px; }
        .project-payment-summary__grid { gap: 5px; }
        .project-payment-summary__item { padding: 6px; }
        .project-payment-summary__item span { font-size: 8.8px; margin-bottom: 3px; }
        .project-payment-summary__item strong { font-size: 10px; }
        .project-payment-method-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
        .project-payment-method-option { padding: 6px; }
        .project-payment-method-title { font-size: 9.2px; margin-bottom: 3px; }
        .project-payment-method-line { font-size: 8.8px; }
        .signature { margin-top: 5px; font-size: 10.6px; line-height: 1.25; }
        .receipt-footer-container { margin-top: 2px; }
        .receipt-footer { margin-top: 0; padding-top: 5px; font-size: 10.3px; line-height: 1.25; }
        .footer-badge { margin-bottom: 3px; font-size: 10.3px; padding: 2px 7px; }
        .social-row { gap: 2px; margin-bottom: 4px; }
        .social-link { font-size: 10px; }
        .footer-divider { margin: 4px auto; }
        .receipt-footer {
          page-break-inside: avoid;
        }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      @media (max-width: 720px) {
        .project-payment-method-list {
          grid-template-columns: 1fr;
        }
      }
      </style>
  </head>
  <body>
    <div class="page${isCompactReceipt ? ' page--compact' : ''}">
      <header>
        ${headerHtml}
      </header>

    <div class="receipt-body">
    <div class="meta">
      <div class="meta-left">
        <div><strong>Date:</strong> ${new Date(snapshot.generatedAt || Date.now()).toLocaleString()}</div>
        <div><strong>M/S:</strong> ${snapshot.customerName || order?.customerName || ''}</div>
        <div><strong>Phone:</strong> ${phoneNumber || '-'}</div>
        <div><strong>Email:</strong> ${customerEmail || '-'}</div>
      </div>
      <div class="right meta-right">
        <div><strong>Receipt No.</strong> ${order.orderNumber || snapshot.serial || ''}</div>
        <div style="margin-top:6px"><strong>Address :</strong> ${deliveryAddress || '-'}</div>
      </div>
    </div>

      ${projectPaymentSummaryHtml}

      <table class="items-table">
        ${itemsHtml}
      </table>

    <table class="totals">
      <tr><td></td><td class="right">Subtotal:</td><td class="right">${formatAmount(subtotalValue)}</td></tr>
      ${snapshot.showDiscount ? `<tr><td></td><td class="right">Discount:</td><td class="right">${formatAmount(toNumberOrNull(snapshot.discount) ?? toNumberOrNull(totals.discount))}</td></tr>` : ''}
      <tr class="total-row"><td></td><td class="right"><strong>Total:</strong></td><td class="right"><strong>${formatAmount(totalValue)}</strong></td></tr>
    </table>

      ${itemWarrantyEntries ? `<div class="item-warranty">${itemWarrantyEntries}</div>` : ''}

      ${notes ? `<div class="notes"><strong>Notes:</strong><div style="margin-top:6px">${notes}</div></div>` : ''}

      <div class="receipt-bottom">
      <div class="signature">
        <p>You were served by ${attendant || '____'}.</p>
        <p>Goods once sold cannot be refunded.</p>
      </div>

      ${allowMarketingFooter ? `
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
      ` : ""}
      </div>

    </div>
    </div>
  </body>
  </html>
  `;
}
