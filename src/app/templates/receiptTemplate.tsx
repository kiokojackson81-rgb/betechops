import * as QRCode from "qrcode";
import { TERMS_URL } from "@/lib/publicLinks";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createQrSvgMarkup(text: string, size = 152) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const cells = qr.modules.size;
  const margin = 2;
  const cellSize = Math.max(2, Math.floor(size / (cells + margin * 2)));
  const dimension = (cells + margin * 2) * cellSize;
  const rects: string[] = [];

  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      if (!qr.modules.get(row, col)) continue;
      rects.push(
        `<rect x="${(col + margin) * cellSize}" y="${(row + margin) * cellSize}" width="${cellSize}" height="${cellSize}" fill="#111111" />`
      );
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 ${dimension} ${dimension}" role="img" aria-label="QR code linking to the Betech Solar terms and conditions page">
      <rect width="${dimension}" height="${dimension}" fill="#ffffff" />
      ${rects.join("")}
    </svg>
  `;
}

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
  const receiptNumber = order.orderNumber || snapshot.serial || snapshot.serialNumber || "";
  const receiptDateText = new Date(snapshot.generatedAt || Date.now()).toLocaleString();
  const companyWebsite = "www.betech.co.ke";
  const companyWebsiteUrl = "https://www.betech.co.ke";
  const companyEmail = "info@betech.co.ke";
  const companyPhonePrimary = "0722 151 083";
  const companyPhoneSecondary = "0703 241 917";
  const companyLocation = "Pramukh Plaza, 3rd Floor, Shop No. 3";
  const termsQrSvg = createQrSvgMarkup(TERMS_URL);

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
  const isProjectFullyPaid = String(projectFlow?.paymentStatus || '').trim().toUpperCase() === 'FULLY_PAID';
  const projectPaymentPlanLabel = (() => {
    const paymentTerm = String(projectFlow?.paymentTerm || '').trim().toUpperCase();
    if (isProjectFullyPaid) {
      switch (paymentTerm) {
        case 'FULL_BEFORE_INSTALLATION':
          return 'Paid fully before installation';
        case 'DEPOSIT_AND_BALANCE':
          return 'Deposit and balance completed';
        case 'FULL_AFTER_INSTALLATION':
          return 'Paid after installation';
        default:
          return 'Payment completed';
      }
    }
    return formatProjectPaymentTerm(projectFlow?.paymentTerm);
  })();
  const projectBalanceLabel = (() => {
    const paymentTerm = String(projectFlow?.paymentTerm || '').trim().toUpperCase();
    if (isProjectFullyPaid) return 'Balance remaining';
    if (paymentTerm === 'FULL_BEFORE_INSTALLATION') return 'Amount due before installation';
    return 'Balance after installation';
  })();
  const fallbackCollectionMethodsHtml = `
    <div class="project-payment-options">
      <div class="project-payment-options__label">Payment options</div>
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
        <div class="project-payment-method-option">
          <div class="project-payment-method-title">Equity Bank</div>
          <div class="project-payment-method-line"><span>Bank:</span> Equity Bank</div>
          <div class="project-payment-method-line"><span>Account Name:</span> Betech Technologies Limited</div>
          <div class="project-payment-method-line"><span>Branch:</span> Moi Avenue</div>
          <div class="project-payment-method-line"><span>Account Number:</span> <strong>0470265072030</strong></div>
        </div>
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
  const projectWarrantyBadge = escapeHtml(
    items.find((it: any) => it?.warranty && String(it.warranty).trim())?.warranty ||
      snapshot.warrantyText ||
      "5 Years"
  );
  const projectPaymentStatusLabel = formatProjectPaymentStatus(projectFlow?.paymentStatus);
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
            <strong>${projectPaymentPlanLabel}</strong>
          </div>
          <div class="project-payment-summary__item">
            <span>Paid so far</span>
            <strong>KES ${formatAmount(toNumberOrNull(projectFlow.totalPaidAmount) ?? 0)}</strong>
          </div>
          ${
            String(projectFlow.paymentTerm || '').trim().toUpperCase() === 'DEPOSIT_AND_BALANCE'
              ? `
              <div class="project-payment-summary__item">
                <span>Deposit paid</span>
                <strong>KES ${formatAmount(toNumberOrNull(projectFlow.depositPaidAmount) ?? 0)}</strong>
              </div>
              <div class="project-payment-summary__item">
                <span>${projectBalanceLabel}</span>
                <strong>KES ${formatAmount(toNumberOrNull(projectFlow.remainingAmount) ?? 0)}</strong>
              </div>`
              : `
              <div class="project-payment-summary__item">
                <span>${projectBalanceLabel}</span>
                <strong>KES ${formatAmount(toNumberOrNull(projectFlow.remainingAmount) ?? 0)}</strong>
              </div>`
          }
        </div>
        ${fallbackCollectionMethodsHtml}
      </div>`
      : '';
  const projectPaymentCardsHtml =
    projectFlow?.isProject
      ? `
      <section class="project-summary-card">
        <div class="project-summary-card__header">
          <div class="project-summary-card__title">PROJECT PAYMENT SUMMARY</div>
          <div class="project-summary-card__badge">${escapeHtml(projectPaymentStatusLabel)}</div>
        </div>
        <div class="project-summary-card__grid">
          <div class="project-summary-card__item">
            <span>Payment plan</span>
            <strong>${escapeHtml(projectPaymentPlanLabel)}</strong>
          </div>
          <div class="project-summary-card__item">
            <span>Paid so far</span>
            <strong>KES ${formatAmount(toNumberOrNull(projectFlow.totalPaidAmount) ?? 0)}</strong>
          </div>
          ${
            String(projectFlow.paymentTerm || "").trim().toUpperCase() === "DEPOSIT_AND_BALANCE"
              ? `
              <div class="project-summary-card__item">
                <span>Deposit paid</span>
                <strong>KES ${formatAmount(toNumberOrNull(projectFlow.depositPaidAmount) ?? 0)}</strong>
              </div>
              <div class="project-summary-card__item">
                <span>${escapeHtml(projectBalanceLabel)}</span>
                <strong>KES ${formatAmount(toNumberOrNull(projectFlow.remainingAmount) ?? 0)}</strong>
              </div>
            `
              : `
              <div class="project-summary-card__item project-summary-card__item--wide">
                <span>${escapeHtml(projectBalanceLabel)}</span>
                <strong>KES ${formatAmount(toNumberOrNull(projectFlow.remainingAmount) ?? 0)}</strong>
              </div>
            `
          }
        </div>
      </section>
      `
      : "";

  const projectPaymentOptionsHtml =
    projectFlow?.isProject
      ? `
      <section class="project-payment-bank-panel">
        <div class="project-payment-bank-panel__title">PAYMENT OPTIONS</div>
        <div class="project-payment-bank-grid">
          <div class="project-payment-bank-card">
            <div class="project-payment-bank-card__brand project-payment-bank-card__brand--mpesa">M-PESA</div>
            <div class="project-payment-bank-card__name">Paybill</div>
            <div class="project-payment-bank-card__line"><span>Paybill Number:</span> 516600</div>
            <div class="project-payment-bank-card__line"><span>Account Number:</span> 0710098001</div>
          </div>
          <div class="project-payment-bank-card">
            <div class="project-payment-bank-card__brand project-payment-bank-card__brand--absa">absa</div>
            <div class="project-payment-bank-card__name">ABSA Bank</div>
            <div class="project-payment-bank-card__line"><span>Bank:</span> Absa Bank Kenya</div>
            <div class="project-payment-bank-card__line"><span>Account Name:</span> Betech Solar Solution</div>
            <div class="project-payment-bank-card__line"><span>Account Number:</span> 2047639940</div>
          </div>
          <div class="project-payment-bank-card">
            <div class="project-payment-bank-card__brand project-payment-bank-card__brand--equity">EQUITY</div>
            <div class="project-payment-bank-card__name">Equity Bank</div>
            <div class="project-payment-bank-card__line"><span>Bank:</span> Equity Bank</div>
            <div class="project-payment-bank-card__line"><span>Account Name:</span> Betech Technologies Limited</div>
            <div class="project-payment-bank-card__line"><span>Branch:</span> Moi Avenue</div>
            <div class="project-payment-bank-card__line"><span>Account Number:</span> 0470265072030</div>
          </div>
        </div>
      </section>
      `
      : "";

  const projectTermsPanelHtml =
    projectFlow?.isProject
      ? `
      <section class="project-terms-panel">
        <div class="project-terms-panel__heading">SOLAR INSTALLATION<br/>TERMS &amp; CONDITIONS</div>
        <p class="project-terms-panel__notice">By proceeding with payment, delivery, or installation of a solar system by Betech Solar Solutions, you confirm that you have had access to and agree to our Solar Installation, Performance, Warranty &amp; After-Sales Terms &amp; Conditions.</p>
        <div class="project-terms-panel__label">View full Terms:</div>
        <a class="project-terms-panel__link" href="${TERMS_URL}" target="_blank" rel="noopener noreferrer" aria-label="Open full Betech Solar terms and conditions">
          betech.co.ke/p/terms
        </a>
        <div class="project-terms-panel__qrbox">
          <div class="project-terms-panel__qr">${termsQrSvg}</div>
          <div class="project-terms-panel__qrcaption">Scan to read the full Terms &amp; Conditions</div>
        </div>
        <p class="project-terms-panel__summary">These Terms cover installation scope, system performance expectations, battery backup, solar generation, workmanship support, manufacturer warranties, after-sales procedures, internal electrical wiring responsibilities, system upgrades, and other applicable installation conditions.</p>
      </section>
      `
      : "";

  const projectItemsHtml = items
    .map((it: any, index: number) => {
      const qty = Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1;
      const unit = Number.isFinite(Number(it.unitPrice ?? it.sellingPrice)) ? Number(it.unitPrice ?? it.sellingPrice) : 0;
      const lineTotal = qty * unit;
      const title = escapeHtml(it.title || it.productName || "Item");
      return `
        <section class="project-item-block${index ? " project-item-block--spaced" : ""}">
          <div class="project-item-block__label">ITEM NAME</div>
          <div class="project-item-block__title">${title}</div>
          <div class="project-item-block__warranty">Warranty: ${projectWarrantyBadge}</div>
          <table class="project-line-table">
            <thead>
              <tr>
                <th>QUANTITY</th>
                <th class="right">UNIT PRICE</th>
                <th class="right">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${qty}</td>
                <td class="right">${formatAmount(unit)}</td>
                <td class="right project-line-table__strong">${formatAmount(lineTotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      `;
    })
    .join("");

  const projectFooterHtml = `
    <section class="project-bottom-notice">
      <div class="project-bottom-notice__left">
        <div class="project-bottom-notice__row">You were served by ${escapeHtml(attendant || "____")}.</div>
        <div class="project-bottom-notice__row">Goods once sold cannot be refunded.</div>
      </div>
      <div class="project-bottom-notice__right">
        <div>By proceeding with installation, you agree to our Solar Installation Terms &amp; Conditions:</div>
        <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer">betech.co.ke/p/terms</a>
      </div>
    </section>
  `;

  if (projectFlow?.isProject) {
    return `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${siteTitle} Project Receipt ${receiptNumber}</title>
      <style>
        :root { --brandColor: ${brandColor}; }
        @page { size: A4 portrait; margin: 7mm; }
        html, body {
          margin: 0;
          padding: 0;
          background: #f4f4f5;
          color: #111827;
          font-family: "Segoe UI", Arial, Helvetica, sans-serif;
        }
        body { padding: 10px; }
        .project-page {
          width: min(100%, 192mm);
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #d9dde3;
          border-radius: 18px;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
          padding: 12mm 10mm 9mm;
          box-sizing: border-box;
        }
        .project-header {
          border-bottom: 2px solid ${brandColor};
          padding-bottom: 10px;
          margin-bottom: 12px;
        }
        .project-header__top {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 14px;
          align-items: start;
        }
        .project-header__logo {
          width: 118px;
          max-width: 100%;
          object-fit: contain;
        }
        .project-header__brand {
          text-align: center;
        }
        .project-header__brand h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.05;
          font-weight: 900;
          color: ${brandColor};
          letter-spacing: 0.02em;
        }
        .project-header__brand p {
          margin: 4px 0 0;
          font-size: 13px;
          color: #1f2937;
        }
        .project-header__contact {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px 16px;
          margin-top: 10px;
          font-size: 12px;
          color: #1f2937;
        }
        .project-header__contact strong {
          color: ${brandColor};
          margin-right: 6px;
        }
        .project-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }
        .project-info-card {
          border: 1px solid #d6dbe2;
          border-radius: 14px;
          background: #fff;
          padding: 12px 14px;
          font-size: 13px;
          line-height: 1.65;
        }
        .project-info-card__row strong {
          font-size: 13px;
          color: #111827;
          margin-right: 6px;
        }
        .project-item-block__label {
          font-size: 12px;
          font-weight: 900;
          color: ${brandColor};
          margin-bottom: 6px;
        }
        .project-item-block__title {
          font-size: 13px;
          line-height: 1.55;
          font-weight: 700;
          color: #111827;
        }
        .project-item-block__warranty {
          display: inline-block;
          margin-top: 8px;
          padding: 5px 10px;
          border: 1px solid #bfd0ea;
          border-radius: 10px;
          background: #f4f8ff;
          color: #1d4f91;
          font-size: 12px;
          font-weight: 700;
        }
        .project-line-table,
        .project-total-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
          font-size: 13px;
        }
        .project-line-table th,
        .project-line-table td,
        .project-total-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #e4e7eb;
        }
        .project-line-table th {
          color: ${brandColor};
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .right { text-align: right; }
        .project-line-table__strong {
          font-weight: 900;
          font-size: 14px;
          color: #111827;
        }
        .project-total-table {
          width: 44%;
          margin-left: auto;
          margin-top: 2px;
        }
        .project-total-table__grand td {
          font-size: 16px;
          font-weight: 900;
          color: ${brandColor};
        }
        .project-panels-grid {
          display: grid;
          grid-template-columns: 1.18fr 0.92fr;
          gap: 14px;
          margin-top: 16px;
          align-items: start;
        }
        .project-summary-card {
          border: 1px solid #d8e3f2;
          border-radius: 14px;
          background: #f6fbff;
          padding: 12px;
        }
        .project-summary-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }
        .project-summary-card__title {
          font-size: 12px;
          font-weight: 900;
          color: ${brandColor};
        }
        .project-summary-card__badge {
          border: 1px solid rgba(122, 32, 32, 0.18);
          border-radius: 10px;
          padding: 5px 10px;
          background: #fff5f5;
          color: ${brandColor};
          font-size: 11px;
          font-weight: 800;
        }
        .project-summary-card__grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .project-summary-card__item {
          border: 1px solid #d5dce5;
          border-radius: 10px;
          background: #fff;
          padding: 10px;
        }
        .project-summary-card__item--wide {
          grid-column: 1 / -1;
        }
        .project-summary-card__item span {
          display: block;
          font-size: 11px;
          color: #475569;
          margin-bottom: 4px;
        }
        .project-summary-card__item strong {
          display: block;
          font-size: 13px;
          color: #111827;
        }
        .project-payment-bank-panel {
          margin-top: 12px;
        }
        .project-payment-bank-panel__title {
          margin-bottom: 10px;
          color: #1d4f91;
          font-size: 12px;
          font-weight: 900;
        }
        .project-payment-bank-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .project-payment-bank-card {
          border: 1px solid #d5dce5;
          border-radius: 10px;
          background: #fff;
          padding: 10px;
        }
        .project-payment-bank-card__brand {
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 4px;
        }
        .project-payment-bank-card__brand--mpesa { color: #2f9d46; }
        .project-payment-bank-card__brand--absa { color: #dc2626; text-transform: lowercase; }
        .project-payment-bank-card__brand--equity { color: #7c2d12; }
        .project-payment-bank-card__name {
          font-size: 12px;
          font-weight: 800;
          color: ${brandColor};
          margin-bottom: 10px;
        }
        .project-payment-bank-card__line {
          font-size: 11px;
          line-height: 1.5;
          color: #111827;
          margin-top: 5px;
        }
        .project-payment-bank-card__line span {
          font-weight: 700;
        }
        .project-terms-panel {
          border: 1px solid #f2c58f;
          border-radius: 14px;
          background: #fff9ef;
          padding: 12px;
        }
        .project-terms-panel__heading {
          font-size: 14px;
          line-height: 1.2;
          font-weight: 900;
          color: ${brandColor};
          margin-bottom: 10px;
        }
        .project-terms-panel__notice {
          margin: 0 0 10px;
          font-size: 12px;
          line-height: 1.5;
        }
        .project-terms-panel__label {
          font-size: 12px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 6px;
        }
        .project-terms-panel__link {
          display: inline-block;
          margin-bottom: 12px;
          border-radius: 10px;
          background: ${brandColor};
          color: #ffffff;
          text-decoration: none;
          font-size: 14px;
          font-weight: 900;
          padding: 10px 12px;
        }
        .project-terms-panel__qrbox {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          align-items: center;
          border: 1px dashed #d97706;
          border-radius: 12px;
          background: #fff;
          padding: 10px;
          margin-bottom: 10px;
        }
        .project-terms-panel__qr svg {
          display: block;
          width: 132px;
          height: 132px;
        }
        .project-terms-panel__qrcaption {
          font-size: 12px;
          line-height: 1.45;
          color: #111827;
        }
        .project-terms-panel__summary {
          margin: 0;
          font-size: 11.5px;
          line-height: 1.45;
          color: #1f2937;
        }
        .project-bottom-notice {
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          gap: 14px;
          margin-top: 12px;
          border: 1px dashed #d26b6b;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 12px;
          line-height: 1.55;
        }
        .project-bottom-notice__row + .project-bottom-notice__row {
          margin-top: 6px;
        }
        .project-bottom-notice__right a {
          display: inline-block;
          margin-top: 4px;
          color: ${brandColor};
          font-weight: 900;
          text-decoration: none;
        }
        .project-social-footer {
          margin-top: 12px;
          border: 1px solid #d8dce2;
          border-radius: 14px;
          padding: 12px 14px;
        }
        .project-social-footer__title {
          text-align: center;
          font-size: 12px;
          font-weight: 900;
          color: ${brandColor};
        }
        .project-social-footer__subtitle {
          text-align: center;
          font-size: 11px;
          color: #374151;
          margin: 5px 0 10px;
        }
        .project-social-footer__grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .project-social-footer__item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
        }
        .project-social-footer__icon {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 12px;
          font-weight: 900;
        }
        .project-social-footer__icon--facebook { background: #1877f2; }
        .project-social-footer__icon--instagram { background: linear-gradient(135deg, #f58529, #dd2a7b, #8134af); }
        .project-social-footer__icon--tiktok { background: #111827; }
        .project-social-footer__thanks {
          text-align: center;
          margin-top: 12px;
          font-size: 14px;
          font-weight: 900;
          color: ${brandColor};
        }
        .project-social-footer__hash {
          text-align: center;
          font-size: 12px;
          margin-top: 2px;
        }
        .project-social-footer__hash a {
          color: #1d4ed8;
          font-weight: 900;
          text-decoration: none;
        }
        @media (max-width: 900px) {
          .project-info-grid,
          .project-panels-grid,
          .project-bottom-notice,
          .project-social-footer__grid,
          .project-header__contact,
          .project-payment-bank-grid,
          .project-terms-panel__qrbox {
            grid-template-columns: 1fr;
          }
          .project-total-table {
            width: 100%;
          }
          .project-header__top {
            grid-template-columns: 1fr;
          }
          .project-header__brand {
            text-align: left;
          }
          .project-page {
            padding: 10mm 8mm;
          }
        }
        @media print {
          html, body {
            background: #ffffff;
            padding: 0;
            margin: 0;
          }
          body { font-size: 12px; }
          .project-page {
            width: auto;
            margin: 0;
            border: none;
            border-radius: 0;
            box-shadow: none;
            padding: 0;
          }
          .project-page, .project-info-card, .project-summary-card, .project-terms-panel, .project-payment-bank-card, .project-bottom-notice, .project-social-footer, .project-item-block {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="project-page">
        <section class="project-header">
          <div class="project-header__top">
            <img class="project-header__logo" src="${escapeHtml(logoUrl)}" alt="Betech Solar Solutions logo" />
            <div class="project-header__brand">
              <h1>${escapeHtml(siteTitle)}</h1>
              <p>Dealers in: Solar Solutions, Solar Products, e.t.c</p>
              <div class="project-header__contact">
                <div><strong>Tel:</strong>${companyPhonePrimary} / ${companyPhoneSecondary}</div>
                <div><strong>Location:</strong>${companyLocation}</div>
                <div><strong>Email:</strong>${companyEmail}</div>
                <div><strong>Website:</strong>${companyWebsite}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="project-info-grid">
          <div class="project-info-card">
            <div class="project-info-card__row"><strong>Date:</strong> ${escapeHtml(receiptDateText)}</div>
            <div class="project-info-card__row"><strong>M/S:</strong> ${escapeHtml(snapshot.customerName || order?.customerName || "")}</div>
            <div class="project-info-card__row"><strong>Phone:</strong> ${escapeHtml(phoneNumber || "-")}</div>
            <div class="project-info-card__row"><strong>Email:</strong> ${escapeHtml(customerEmail || "-")}</div>
          </div>
          <div class="project-info-card">
            <div class="project-info-card__row"><strong>Receipt No.</strong> ${escapeHtml(receiptNumber)}</div>
            <div class="project-info-card__row" style="margin-top: 10px;"><strong>Address:</strong> ${escapeHtml(deliveryAddress || "-")}</div>
          </div>
        </section>

        ${projectItemsHtml}

        <table class="project-total-table">
          <tr>
            <td></td>
            <td class="right">Subtotal:</td>
            <td class="right">${formatAmount(subtotalValue)}</td>
          </tr>
          ${
            snapshot.showDiscount
              ? `<tr><td></td><td class="right">Discount:</td><td class="right">${formatAmount(toNumberOrNull(snapshot.discount) ?? toNumberOrNull(totals.discount))}</td></tr>`
              : ""
          }
          <tr class="project-total-table__grand">
            <td></td>
            <td class="right">Total:</td>
            <td class="right">${formatAmount(totalValue)}</td>
          </tr>
        </table>

        <section class="project-panels-grid">
          <div>
            ${projectPaymentCardsHtml}
            ${projectPaymentOptionsHtml}
          </div>
          <div>
            ${projectTermsPanelHtml}
          </div>
        </section>

        ${projectFooterHtml}

        ${
          allowMarketingFooter
            ? `
            <section class="project-social-footer">
              <div class="project-social-footer__title">CONNECT WITH US</div>
              <div class="project-social-footer__subtitle">Follow &amp; see our latest solar projects:</div>
              <div class="project-social-footer__grid">
                <div class="project-social-footer__item">
                  <span class="project-social-footer__icon project-social-footer__icon--facebook">f</span>
                  <div><strong>Facebook:</strong><br/>Betech Solar Solutions Kenya</div>
                </div>
                <div class="project-social-footer__item">
                  <span class="project-social-footer__icon project-social-footer__icon--instagram">ig</span>
                  <div><strong>Instagram:</strong><br/>@betechsolarsolutionskenya</div>
                </div>
                <div class="project-social-footer__item">
                  <span class="project-social-footer__icon project-social-footer__icon--tiktok">tt</span>
                  <div><strong>TikTok:</strong><br/>@betechsolarsolutionske</div>
                </div>
              </div>
              <div class="project-social-footer__thanks">Thank you for choosing Betech Solar Solutions.</div>
              <div class="project-social-footer__hash">View our recent installations: <a href="https://www.tiktok.com/tag/betechprojects" target="_blank" rel="noopener noreferrer">#BetechProjects</a></div>
            </section>
          `
            : ""
        }
      </div>
    </body>
    </html>
    `;
  }

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
        .project-payment-options {
          margin-top: 10px;
        }
        .project-payment-options__label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #64748b;
          margin-bottom: 6px;
        }
        .project-payment-method-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
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
        .project-payment-options { margin-top: 7px; }
        .project-payment-options__label { font-size: 8.5px; margin-bottom: 4px; }
        .project-payment-method-list { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
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

      <table class="items-table">
        ${itemsHtml}
      </table>

    <table class="totals">
      <tr><td></td><td class="right">Subtotal:</td><td class="right">${formatAmount(subtotalValue)}</td></tr>
      ${snapshot.showDiscount ? `<tr><td></td><td class="right">Discount:</td><td class="right">${formatAmount(toNumberOrNull(snapshot.discount) ?? toNumberOrNull(totals.discount))}</td></tr>` : ''}
      <tr class="total-row"><td></td><td class="right"><strong>Total:</strong></td><td class="right"><strong>${formatAmount(totalValue)}</strong></td></tr>
    </table>

      ${projectPaymentSummaryHtml}

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
