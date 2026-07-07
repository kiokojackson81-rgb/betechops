import {
  escapeHtml,
  formatMoney,
  normalizeQuotePdfData,
  type QuotePdfInput,
} from "@/lib/normalizeQuotePdfData";

function renderRows(rows: Array<[string, string | null | undefined]>) {
  return rows
    .filter(([, value]) => String(value || "").trim())
    .map(
      ([label, value]) => `
        <div class="info-row">
          <div class="key">${escapeHtml(label)}</div>
          <div class="val">${escapeHtml(value)}</div>
        </div>
      `,
    )
    .join("");
}

function renderList(items: readonly string[]) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderPaymentMethods(
  methods: ReadonlyArray<{ title: string; lines: readonly string[] }>,
) {
  return methods
    .map(
      (method) => `
        <div class="pay-method">
          <div class="pay-title">${escapeHtml(method.title)}</div>
          ${method.lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
        </div>
      `,
    )
    .join("");
}

function renderBoqRows(
  items: ReturnType<typeof normalizeQuotePdfData>["items"],
  wholeWarrantyText: string | null,
) {
  return items
    .map(
      (item) => `
        <tr>
          <td class="center">${item.index}</td>
          <td>
            <div class="item-name">${escapeHtml(item.name)}</div>
            ${item.description ? `<div class="item-desc">${escapeHtml(item.description)}</div>` : ""}
          </td>
          <td class="center">${escapeHtml(item.quantity)}</td>
          <td class="right">${escapeHtml(formatMoney(item.unitPrice))}</td>
          <td class="right">${escapeHtml(formatMoney(item.amount))}</td>
          <td>${escapeHtml(wholeWarrantyText || item.warrantyText)}</td>
        </tr>
      `,
    )
    .join("");
}

export function buildQuotationHtml(
  input: QuotePdfInput,
  assets: {
    letterheadUrl: string | null;
  },
) {
  const data = normalizeQuotePdfData(input);
  const wholeWarrantyText =
    data.warrantyMode === "WHOLE_QUOTATION" || data.warrantyMode === "FULL_SYSTEM"
      ? data.items[0]?.warrantyText || null
      : null;
  const costRows = [
    ["Equipment", data.equipmentTotal],
    ["Installation", data.installationTotal],
    ["Transport", data.transportTotal],
    ["Project Value", data.grandTotal],
  ] as const;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(data.quoteRef)}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #edf1f5;
    color: #1f2933;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9.6px;
    line-height: 1.22;
  }
  .sheet {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto 10px;
    background: #ffffff;
    padding: 0 8mm 7mm;
    position: relative;
    overflow: hidden;
  }
  .sheet.page-break { break-before: page; }
  .letterhead {
    width: calc(100% + 16mm);
    margin-left: -8mm;
    display: block;
    border-bottom: 2px solid #8b1212;
  }
  .page-body { padding-top: 4.5mm; }
  .kicker {
    letter-spacing: 3px;
    color: #8b1212;
    font-weight: 800;
    font-size: 10.5px;
    text-transform: uppercase;
    margin-bottom: 3px;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    line-height: 1.05;
    text-transform: uppercase;
  }
  h2 {
    margin: 0 0 5px;
    font-size: 11px;
    color: #8b1212;
    text-transform: uppercase;
    letter-spacing: .35px;
  }
  p { margin: 0; }
  .hero {
    display: grid;
    grid-template-columns: 1fr 49mm;
    gap: 8mm;
    align-items: start;
    margin-bottom: 4mm;
  }
  .intro {
    margin-top: 4px;
    font-size: 10px;
    max-width: 128mm;
    font-weight: 600;
  }
  .valid {
    border: 1px solid #c7b5b5;
    border-radius: 5px;
    padding: 8px 10px;
    text-align: center;
    margin-top: 8mm;
  }
  .valid .label {
    font-size: 10px;
    color: #8b1212;
    font-weight: 800;
    margin-bottom: 4px;
  }
  .valid .date {
    font-size: 16px;
    font-weight: 800;
    line-height: 1.14;
  }
  .cards3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3mm;
    margin-bottom: 3mm;
  }
  .card, .section, .plain-card {
    border: 1px solid #d7cdcd;
    border-radius: 5px;
    background: #fff;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .card { padding: 8px; }
  .info-row {
    display: grid;
    grid-template-columns: 26mm 1fr;
    gap: 4px;
    margin: 0 0 4px;
  }
  .info-row:last-child { margin-bottom: 0; }
  .key {
    color: #8b1212;
    font-size: 8.3px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .val {
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .section { margin-bottom: 3mm; }
  .bar {
    background: #8b1212;
    color: #fff;
    padding: 5px 8px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    border-radius: 5px 5px 0 0;
    letter-spacing: .25px;
  }
  .content { padding: 7px 8px; }
  .boq {
    width: 100%;
    border-collapse: collapse;
  }
  .boq th {
    background: #8b1212;
    color: #fff;
    font-size: 8.1px;
    padding: 5px 6px;
    text-transform: uppercase;
    text-align: left;
  }
  .boq td {
    border: 1px solid #ddd4d4;
    padding: 5px 6px;
    vertical-align: top;
    font-size: 9.1px;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .item-name { font-weight: 800; color: #18212c; }
  .item-desc { margin-top: 2px; color: #5b6570; font-size: 8.6px; }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3mm;
    margin-bottom: 3mm;
  }
  .three-cols {
    display: grid;
    grid-template-columns: 1.1fr 1fr 1fr;
    gap: 3mm;
    margin-bottom: 3mm;
  }
  .plain-card { padding: 7px 8px; }
  .mini-table { width: 100%; border-collapse: collapse; }
  .mini-table td {
    border: 1px solid #ddd4d4;
    padding: 5px 6px;
    vertical-align: top;
  }
  .mini-table td:first-child {
    width: 40%;
    color: #8b1212;
    font-weight: 800;
    text-transform: uppercase;
  }
  ul { margin: 0; padding-left: 14px; }
  li { margin-bottom: 3px; }
  .pay-title {
    color: #8b1212;
    font-weight: 800;
    margin-bottom: 3px;
  }
  .pay-method {
    border-top: 1px solid #ece3e3;
    padding: 5px 0;
  }
  .pay-method:first-child { border-top: 0; padding-top: 0; }
  .links {
    display: grid;
    grid-template-columns: 1.05fr 1fr;
    gap: 3mm;
    margin-bottom: 3mm;
  }
  .notes-box {
    border: 1px dashed #cfb9b9;
    border-radius: 5px;
    background: #fff9f7;
    padding: 7px 8px;
    min-height: 16mm;
  }
  .footer {
    position: absolute;
    left: 8mm;
    right: 8mm;
    bottom: 4mm;
    border-top: 1px solid #8b1212;
    padding-top: 3px;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 7.8px;
  }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; page-break-after: always; box-shadow: none; }
  }
</style>
</head>
<body>
<section class="sheet">
  ${assets.letterheadUrl ? `<img class="letterhead" src="${assets.letterheadUrl}" alt="Betech letterhead" />` : ""}
  <div class="page-body">
    <div class="hero">
      <div>
        <div class="kicker">Official Customer Quotation</div>
        <h1>${escapeHtml(data.title)}</h1>
        <p class="intro">${escapeHtml(data.intro)}</p>
      </div>
      <div class="valid">
        <div class="label">VALID UNTIL</div>
        <div class="date">${escapeHtml(data.validUntilLabel).replace(" ", "<br/>")}</div>
      </div>
    </div>

    <div class="cards3">
      <div class="card">
        <h2>Customer Information</h2>
        ${renderRows([
          ["Customer Name", data.customer.name],
          ["Phone", data.customer.phone],
          ["Email", data.customer.email],
          ["Location", data.customer.location],
        ])}
      </div>
      <div class="card">
        <h2>Prepared By</h2>
        ${renderRows([
          ["Team", data.preparedBy.team],
          ["Lead Technician", data.preparedBy.leadTechnicianName],
          ["Technician Phone", data.preparedBy.leadTechnicianPhone],
          ["Sales Desk", data.preparedBy.salesDesk],
        ])}
      </div>
      <div class="card">
        <h2>Company Details</h2>
        ${renderRows([
          ["Company", data.company.name],
          ["Registration", data.company.registrationNo],
          ["KRA PIN", data.company.kraPin],
          ["Office", data.company.office],
        ])}
      </div>
    </div>

    <div class="section">
      <div class="bar">Detailed Bill of Quantities</div>
      <div class="content" style="padding:0;">
        <table class="boq">
          <thead>
            <tr>
              <th style="width:8%;">#</th>
              <th style="width:40%;">Description</th>
              <th style="width:8%;">Qty</th>
              <th style="width:14%;">Unit Price (KSh)</th>
              <th style="width:14%;">Amount (KSh)</th>
              <th style="width:16%;">Warranty</th>
            </tr>
          </thead>
          <tbody>
            ${renderBoqRows(data.items, wholeWarrantyText)}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid2">
      <div class="section">
        <div class="bar">Cost Breakdown</div>
        <div class="content">
          <table class="mini-table">
            ${costRows
              .map(
                ([label, amount]) => `
                  <tr>
                    <td>${escapeHtml(label)}</td>
                    <td>${escapeHtml(formatMoney(amount))}</td>
                  </tr>
                `,
              )
              .join("")}
          </table>
        </div>
      </div>
      <div class="section">
        <div class="bar">Warranty Notes</div>
        <div class="content">
          ${renderList(
            wholeWarrantyText
              ? [wholeWarrantyText, ...data.warrantyNotes]
              : data.warrantyNotes,
          )}
        </div>
      </div>
    </div>
  </div>
  <div class="footer">
    <span>${escapeHtml(data.quoteRef)}</span>
    <span>${escapeHtml(data.company.name)}</span>
    <span>Page 1 of 2</span>
  </div>
</section>

<section class="sheet page-break">
  <div class="page-body">
    <div class="three-cols">
      <div class="section">
        <div class="bar">Payment, Delivery &amp; Next Steps</div>
        <div class="content">
          <table class="mini-table">
            <tr><td>Quotation Date</td><td>${escapeHtml(data.quotationDateLabel)}</td></tr>
            <tr><td>Valid Until</td><td>${escapeHtml(data.validUntilLabel)}</td></tr>
            <tr><td>Payment Terms</td><td>${escapeHtml(data.paymentTermsLabel)}</td></tr>
            <tr><td>Delivery</td><td>${escapeHtml(data.deliveryText)}</td></tr>
            <tr><td>Installation</td><td>${escapeHtml(data.installationText)}</td></tr>
          </table>
        </div>
      </div>
      <div class="section">
        <div class="bar">Payment Terms</div>
        <div class="content">
          <ul>
            <li>Full payment before installation.</li>
            <li>30% deposit with balance after installation.</li>
            <li>Full payment after installation where approved by management.</li>
          </ul>
        </div>
      </div>
      <div class="section">
        <div class="bar">Approval &amp; Next Steps</div>
        <div class="content">
          <ol style="margin:0; padding-left:16px;">
            <li>Review the proposal scope, pricing, and warranty coverage.</li>
            <li>Confirm any item adjustments, preferred payment method, or project timing.</li>
            <li>Share approval through phone, email, or WhatsApp so implementation planning can begin.</li>
          </ol>
        </div>
      </div>
    </div>

    <div class="links">
      <div class="section">
        <div class="bar">Payment Methods</div>
        <div class="content">
          ${renderPaymentMethods(data.paymentMethods)}
        </div>
      </div>
      <div class="section">
        <div class="bar">Useful Links</div>
        <div class="content">
          <ul>
            <li>View recent projects: ${escapeHtml(data.company.projectsUrl)}</li>
            <li>View all products: ${escapeHtml(data.company.website)}</li>
            <li>Email: ${escapeHtml(data.company.email)}</li>
            <li>Technical sales: jackson@betech.co.ke</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="grid2">
      <div class="section">
        <div class="bar">Contact Betech</div>
        <div class="content">
          ${renderRows([
            ["Sales Desk", data.company.salesDesk],
            ["Email", data.company.email],
            ["Website", data.company.website],
            ["Office", data.company.office],
          ])}
        </div>
      </div>
      <div class="section">
        <div class="bar">After-Sales Support</div>
        <div class="content">${renderList(data.afterSalesSupport)}</div>
      </div>
    </div>

    ${
      data.customerNotes
        ? `
          <div class="section">
            <div class="bar">Optional Notes to Customer</div>
            <div class="content"><div class="notes-box">${escapeHtml(data.customerNotes)}</div></div>
          </div>
        `
        : ""
    }

    <div class="section">
      <div class="bar">Terms and Conditions</div>
      <div class="content">${renderList(data.termsAndConditions)}</div>
    </div>
  </div>
  <div class="footer">
    <span>${escapeHtml(data.quoteRef)}</span>
    <span>${escapeHtml(data.company.name)}</span>
    <span>Page 2 of 2</span>
  </div>
</section>
</body>
</html>`;
}
