import {
  escapeHtml,
  formatMoney,
  normalizeQuotePdfData,
  type QuotePdfInput,
} from "@/lib/normalizeQuotePdfData";

type IconName =
  | "shield"
  | "file"
  | "calendar"
  | "user"
  | "phone"
  | "mail"
  | "location"
  | "users"
  | "briefcase"
  | "id"
  | "building"
  | "package"
  | "truck"
  | "wrench"
  | "wallet"
  | "play"
  | "globe"
  | "headset"
  | "mobile"
  | "search"
  | "edit"
  | "message"
  | "alert"
  | "check";

function iconSvg(name: IconName, className = "icon-svg") {
  const attrs = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${className}"`;
  const paths: Record<IconName, string> = {
    shield:
      '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"/><path d="M9.5 12.5l1.8 1.8 3.7-4.1"/>',
    file:
      '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
    user:
      '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4"/>',
    phone:
      '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.6a2 2 0 0 1-.6 1.8L7 9.9a16 16 0 0 0 7.1 7.1l1.8-1.9a2 2 0 0 1 1.8-.6l2.6.4A2 2 0 0 1 22 16.9z"/>',
    mail:
      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    location:
      '<path d="M12 21s-6-4.8-6-11a6 6 0 0 1 12 0c0 6.2-6 11-6 11z"/><circle cx="12" cy="10" r="2.5"/>',
    users:
      '<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    briefcase:
      '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
    id:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M6 16c.8-1.3 3.2-1.3 4 0"/><path d="M13 9h5"/><path d="M13 13h5"/><path d="M13 17h4"/>',
    building:
      '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h.01"/><path d="M15 9h.01"/><path d="M9 13h.01"/><path d="M15 13h.01"/><path d="M11 21v-4h2v4"/>',
    package:
      '<path d="M21 8.5 12 13 3 8.5"/><path d="M21 8.5V17l-9 4-9-4V8.5"/><path d="M12 13v8"/><path d="m3.5 8 8.5-5 8.5 5"/>',
    truck:
      '<path d="M10 17H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h8v12z"/><path d="M14 9h3l3 3v5h-6"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="17.5" cy="17.5" r="1.5"/>',
    wrench:
      '<path d="M14.7 6.3a4 4 0 0 0-5 5l-5.4 5.4a1.4 1.4 0 1 0 2 2l5.4-5.4a4 4 0 0 0 5-5l-2.3 2.3-2.7-.7-.7-2.7 2.3-2.3z"/>',
    wallet:
      '<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H5a2 2 0 0 0-2 2z"/><rect x="3" y="8" width="18" height="11" rx="2"/><path d="M16 13h.01"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18"/><path d="M12 3a15 15 0 0 0 0 18"/>',
    headset:
      '<path d="M4 12a8 8 0 0 1 16 0"/><rect x="3" y="11" width="4" height="7" rx="2"/><rect x="17" y="11" width="4" height="7" rx="2"/><path d="M7 18a2 2 0 0 0 2 2h3"/><rect x="10" y="19" width="4" height="2" rx="1"/>',
    mobile: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 5h2"/><path d="M12 18h.01"/>',
    search:
      '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/>',
    edit:
      '<path d="M12 20h9"/><path d="m16.5 3.5 4 4L8 20l-5 1 1-5 12.5-12.5z"/>',
    message:
      '<path d="M21 12a8.5 8.5 0 0 1-8.5 8.5A8.6 8.6 0 0 1 8 19.2L3 20.5l1.3-5A8.6 8.6 0 0 1 3.5 12 8.5 8.5 0 1 1 21 12z"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16h.01"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.3 2.3 4.7-5.1"/>',
  };
  return `<svg ${attrs}>${paths[name]}</svg>`;
}

function renderRows(
  rows: Array<[IconName, string, string | null | undefined]>,
  valueClassName = "",
) {
  return rows
    .filter(([, , value]) => String(value || "").trim())
    .map(
      ([icon, label, value]) => `
        <div class="detail-row">
          <div class="detail-icon">${iconSvg(icon)}</div>
          <div class="detail-label">${escapeHtml(label)}</div>
          <div class="detail-value ${valueClassName}">${escapeHtml(value)}</div>
        </div>
      `,
    )
    .join("");
}

function renderIconList(items: readonly string[], icon: IconName) {
  return items
    .map(
      (item) => `
        <div class="mini-row">
          <div class="mini-icon">${iconSvg(icon)}</div>
          <div class="mini-text">${escapeHtml(item)}</div>
        </div>
      `,
    )
    .join("");
}

function renderPaymentMethods(
  methods: ReadonlyArray<{ title: string; lines: readonly string[] }>,
) {
  const iconByTitle = (title: string) => {
    if (/mpesa/i.test(title)) return "wallet";
    if (/absa/i.test(title)) return "building";
    return "briefcase";
  };

  return methods
    .map(
      (method) => `
        <div class="pay-card">
          <div class="pay-head">
            <div class="pay-icon">${iconSvg(iconByTitle(method.title) as IconName)}</div>
            <div class="pay-title">${escapeHtml(method.title)}</div>
          </div>
          <div class="pay-lines">
            ${method.lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
          </div>
        </div>
      `,
    )
    .join("");
}

function renderBoqRows(items: ReturnType<typeof normalizeQuotePdfData>["items"]) {
  return items
    .map(
      (item, index) => `
        <tr class="${index % 2 === 0 ? "boq-row-even" : "boq-row-odd"}">
          <td class="center">${item.index}</td>
          <td>
            <div class="item-name">${escapeHtml(item.name)}</div>
            ${item.description ? `<div class="item-desc">${escapeHtml(item.description)}</div>` : ""}
          </td>
          <td class="center">${escapeHtml(item.quantity)}</td>
          <td class="right">${escapeHtml(formatMoney(item.unitPrice))}</td>
          <td class="right amount-cell">${escapeHtml(formatMoney(item.amount))}</td>
          <td><span class="warranty-pill">${escapeHtml(item.warrantyText)}</span></td>
        </tr>
      `,
    )
    .join("");
}

function renderCostRows(rows: ReadonlyArray<readonly [string, number]>) {
  const iconByLabel = (label: string): IconName => {
    if (/installation/i.test(label)) return "wrench";
    if (/transport/i.test(label)) return "truck";
    if (/project value/i.test(label)) return "wallet";
    return "package";
  };

  return rows
    .map(
      ([label, amount]) => `
        <div class="cost-row ${/project value/i.test(label) ? "cost-row-total" : ""}">
          <div class="cost-row-icon">${iconSvg(iconByLabel(label))}</div>
          <div class="cost-row-label">${escapeHtml(label)}</div>
          <div class="cost-row-value">${escapeHtml(formatMoney(amount))}</div>
        </div>
      `,
    )
    .join("");
}

function renderWarrantyNotes(notes: readonly string[]) {
  return notes
    .map((note, index) => {
      const icon = index === 0 ? "shield" : "alert";
      return `
        <div class="mini-row">
          <div class="mini-icon">${iconSvg(icon)}</div>
          <div class="mini-text">${escapeHtml(note)}</div>
        </div>
      `;
    })
    .join("");
}

function renderApprovalTimeline() {
  return `
    <div class="timeline">
      ${[
        ["1", "search", "Review", "Review the proposal scope, pricing, and warranty coverage."],
        ["2", "edit", "Confirm", "Confirm any item adjustments, preferred payment method, or project timing."],
        ["3", "message", "Share Approval", "Share approval through phone, email, or WhatsApp so implementation planning can begin."],
      ]
        .map(
          ([step, icon, title, body], index, list) => `
            <div class="timeline-step">
              <div class="timeline-track">
                <div class="timeline-number">${step}</div>
                ${index < list.length - 1 ? '<div class="timeline-line"></div>' : ""}
              </div>
              <div class="timeline-card-icon">${iconSvg(icon as IconName)}</div>
              <div class="timeline-copy">
                <div class="timeline-title">${title}</div>
                <div class="timeline-text">${body}</div>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderTitleWithAccent(title: string) {
  const match = title.match(/\b\d+(?:\.\d+)?\s?(?:KW|KWH|W|AH)\b/i);
  if (!match || match.index === undefined) return escapeHtml(title);
  const before = title.slice(0, match.index);
  const hit = title.slice(match.index, match.index + match[0].length);
  const after = title.slice(match.index + match[0].length);
  return `${escapeHtml(before)}<span class="accent">${escapeHtml(hit)}</span>${escapeHtml(after)}`;
}

function renderTermsCards(terms: readonly string[]) {
  const cards = [
    ["calendar", "Quotation Validity", terms[0] || "Quotation validity is subject to confirmation at the time of order placement."],
    ["wallet", "Payment Policy", [terms[1], "Full payment before installation.", "30% deposit with balance after installation.", "Full payment after installation where approved by management."].filter(Boolean).slice(1)],
    ["shield", "Warranty Coverage", terms[2] || "Warranty applies under normal use, correct installation, and manufacturer operating conditions."],
    ["user", "Customer Responsibilities", terms[3] || "Customer should confirm the final product scope, payment structure, and site readiness before dispatch or installation planning."],
  ] as const;

  return cards
    .map(([icon, title, body]) => {
      const content = Array.isArray(body)
        ? `<ul class="terms-list">${body.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : `<div class="terms-body">${escapeHtml(body)}</div>`;

      return `
        <div class="terms-card">
          <div class="terms-accent"></div>
          <div class="terms-icon">${iconSvg(icon)}</div>
          <div class="terms-title">${escapeHtml(title)}</div>
          <div class="terms-content">${content}</div>
        </div>
      `;
    })
    .join("");
}

export function buildQuotationHtml(
  input: QuotePdfInput,
  assets: {
    letterheadUrl: string | null;
  },
) {
  const data = normalizeQuotePdfData(input);
  const costRows =
    data.items.length === 1 && data.installationTotal <= 0 && data.transportTotal <= 0
      ? ([["Quoted Item Value", data.equipmentTotal], ["Project Value", data.grandTotal]] as const)
      : ([
          ["Equipment", data.equipmentTotal],
          ["Installation", data.installationTotal],
          ["Transport", data.transportTotal],
          ["Project Value", data.grandTotal],
        ] as const);
  const featuredProjectUrl = data.similarProjectUrl || data.company.projectsUrl;
  const featuredProjectLabel = data.similarProjectUrl
    ? data.similarProjectLabel || "View a similar installation"
    : "View our recent projects";
  const featuredProjectQr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(featuredProjectUrl)}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(data.quoteRef)}</title>
<style>
  @page { size: A4; margin: 6mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f3f4f6;
    color: #2b2b2b;
    font-family: Inter, Arial, Helvetica, sans-serif;
    font-size: 9.6px;
    line-height: 1.38;
  }
  .sheet {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto 10px;
    background: #fafafa;
    padding: 5mm;
    position: relative;
    overflow: hidden;
  }
  .sheet.page-break { break-before: page; }
  .page {
    min-height: 285mm;
    display: flex;
    flex-direction: column;
    gap: 3mm;
  }
  .top-strip {
    border-top: 2px solid #9b1111;
    padding-top: 2.2mm;
  }
  .hero-card,
  .section-card,
  .mini-card,
  .qr-card,
  .terms-card,
  .boq-shell,
  .footer-brand {
    border-radius: 12px;
    background: #ffffff;
    border: 1px solid #e7e7e7;
    box-shadow: 0 2px 8px rgba(0,0,0,.05);
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .hero-card {
    padding: 3.2mm 4.2mm 4mm;
    text-align: center;
    background:
      radial-gradient(circle at top right, rgba(155,17,17,0.05), transparent 30%),
      linear-gradient(180deg, #ffffff 0%, #fffdfd 100%);
  }
  .badge-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 3mm;
    margin-bottom: 3mm;
  }
  .badge-line {
    height: 2px;
    background: linear-gradient(90deg, #9b1111, rgba(155,17,17,0.08));
    border-radius: 999px;
  }
  .badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 3mm;
    padding: 2.4mm 4.4mm;
    border-radius: 999px;
    background: linear-gradient(90deg, #9b1111, #b71c1c);
    color: #fff;
    font-weight: 800;
    font-size: 8.9px;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .badge-pill .icon-badge {
    width: 9mm;
    height: 9mm;
    border-radius: 999px;
    background: #fff;
    color: #9b1111;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .logo-title {
    display: grid;
    grid-template-columns: 24mm 1fr;
    align-items: center;
    gap: 4mm;
    max-width: 175mm;
    margin: 0 auto;
  }
  .brand-mark {
    width: 24mm;
    height: 24mm;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9b1111;
  }
  .brand-mark img {
    width: 100%;
    max-height: 24mm;
    object-fit: contain;
  }
  .brand-fallback {
    width: 100%;
    height: 100%;
    border-radius: 999px;
    background: rgba(155,17,17,0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 17px;
    font-weight: 900;
    letter-spacing: .08em;
  }
  .hero-title {
    margin: 0;
    font-size: 22px;
    line-height: 1.04;
    font-weight: 900;
    color: #202833;
    text-transform: uppercase;
    letter-spacing: -.03em;
    text-align: left;
  }
  .hero-title .accent { color: #b71c1c; }
  .hero-rule {
    width: 28mm;
    height: 2.5px;
    background: linear-gradient(90deg, transparent, #b71c1c, transparent);
    border-radius: 999px;
    margin: 2.8mm auto 2.2mm;
  }
  .hero-intro {
    margin: 0 auto;
    max-width: 146mm;
    font-size: 9.8px;
    color: #2b2b2b;
    line-height: 1.38;
  }
  .meta-card {
    margin: 3mm auto 0;
    max-width: 112mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    overflow: hidden;
  }
  .meta-cell {
    display: flex;
    align-items: center;
    gap: 3mm;
    padding: 2.8mm 3.5mm;
    border-right: 1px solid #ece0e0;
  }
  .meta-cell:last-child { border-right: 0; }
  .meta-icon {
    width: 8mm;
    height: 8mm;
    color: #9b1111;
    flex: 0 0 auto;
  }
  .meta-copy { text-align: left; }
  .meta-label {
    color: #9b1111;
    font-size: 8px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .08em;
  }
  .meta-value {
    margin-top: 1px;
    color: #202833;
    font-size: 10px;
    font-weight: 800;
  }
  .info-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3mm;
  }
  .info-card {
    padding: 4.2mm 3.4mm 3.2mm;
    position: relative;
  }
  .floating-icon {
    position: absolute;
    left: 50%;
    top: -7mm;
    transform: translateX(-50%);
    width: 14mm;
    height: 14mm;
    border-radius: 999px;
    background: linear-gradient(180deg, #b71c1c, #9b1111);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 18px rgba(155,17,17,.22);
  }
  .card-title {
    margin-top: 4mm;
    text-align: center;
    color: #9b1111;
    font-size: 9.3px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .card-divider {
    width: 22mm;
    height: 1.8px;
    margin: 2mm auto 2.4mm;
    background: linear-gradient(90deg, transparent, #b71c1c, transparent);
  }
  .detail-row {
    display: grid;
    grid-template-columns: 8mm 34mm minmax(0,1fr);
    align-items: center;
    gap: 2.4mm;
    padding: 1.9mm 0;
    border-top: 1px solid #f0e5e5;
  }
  .detail-row:first-child { border-top: 0; }
  .detail-icon {
    width: 7mm;
    height: 7mm;
    border-radius: 7px;
    background: #fff5f5;
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .detail-label {
    color: #2b2b2b;
    font-weight: 700;
    font-size: 8.4px;
  }
  .detail-value {
    color: #2b2b2b;
    font-weight: 600;
    font-size: 8.3px;
    line-height: 1.28;
    overflow-wrap: anywhere;
  }
  .section-head {
    display: flex;
    align-items: center;
    gap: 2.6mm;
    padding: 3mm 3.4mm;
    border-radius: 12px 12px 0 0;
    background: linear-gradient(90deg, #9b1111, #b71c1c);
    color: #fff;
  }
  .section-head-icon {
    width: 9.5mm;
    height: 9.5mm;
    border-radius: 999px;
    background: rgba(255,255,255,.15);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .section-head-title {
    font-size: 9.7px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .06em;
  }
  .section-body { padding: 3.1mm; }
  .boq-shell { overflow: hidden; }
  .boq {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }
  .boq th {
    background: #9b1111;
    color: #fff;
    font-size: 7.2px;
    padding: 2.4mm 2.1mm;
    text-transform: uppercase;
    text-align: left;
    letter-spacing: .05em;
  }
  .boq td {
    border-bottom: 1px solid #efe8e8;
    padding: 2.2mm 2.1mm;
    vertical-align: top;
    font-size: 8.2px;
  }
  .boq-row-even td { background: #fff; }
  .boq-row-odd td { background: #fcf7f7; }
  .center { text-align: center; }
  .right { text-align: right; }
  .amount-cell { font-weight: 800; color: #202833; }
  .item-name {
    font-weight: 800;
    color: #202833;
    line-height: 1.35;
  }
  .item-desc {
    margin-top: .8mm;
    color: #666;
    font-size: 7.4px;
    line-height: 1.3;
  }
  .warranty-pill {
    display: inline-flex;
    padding: .9mm 1.8mm;
    border-radius: 999px;
    background: #fff4f4;
    border: 1px solid #f0d5d5;
    color: #9b1111;
    font-size: 7.1px;
    font-weight: 700;
    line-height: 1.25;
  }
  .bottom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3mm;
  }
  .cost-row {
    display: grid;
    grid-template-columns: 9mm 1fr auto;
    align-items: center;
    gap: 2.4mm;
    padding: 2mm 0;
    border-top: 1px solid #f0e4e4;
  }
  .cost-row:first-child { border-top: 0; }
  .cost-row-icon {
    width: 8mm;
    height: 8mm;
    border-radius: 999px;
    background: #fff3f3;
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cost-row-label {
    font-size: 8.7px;
    font-weight: 700;
    color: #2b2b2b;
  }
  .cost-row-value {
    font-size: 9px;
    font-weight: 800;
    color: #202833;
  }
  .cost-row-total {
    margin-top: .6mm;
    padding: 2.4mm;
    border-radius: 12px;
    background: linear-gradient(90deg, rgba(155,17,17,.06), rgba(183,28,28,.1));
    border: 1px solid #efd4d4;
  }
  .cost-note {
    margin-top: 1.6mm;
    color: #666;
    font-size: 8px;
    line-height: 1.3;
  }
  .mini-row {
    display: grid;
    grid-template-columns: 8mm 1fr;
    gap: 2.4mm;
    align-items: start;
    padding: 1.8mm 0;
    border-top: 1px solid #f0e5e5;
  }
  .mini-row:first-child { border-top: 0; }
  .mini-icon {
    width: 7mm;
    height: 7mm;
    border-radius: 999px;
    background: #fff3f3;
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mini-text {
    font-size: 8.2px;
    color: #2b2b2b;
    line-height: 1.3;
  }
  .full-card {
    overflow: hidden;
  }
  .links-layout {
    display: grid;
    grid-template-columns: 1.5fr .72fr;
    gap: 3mm;
    align-items: stretch;
  }
  .links-list {
    display: grid;
    gap: 0;
  }
  .link-row {
    display: grid;
    grid-template-columns: 22mm 1px 1fr;
    gap: 3mm;
    align-items: start;
    padding: 2.2mm 0;
    border-top: 1px solid #ece3e3;
  }
  .link-row:first-child { border-top: 0; }
  .link-circle {
    width: 14mm;
    height: 14mm;
    margin-left: 1mm;
    border-radius: 999px;
    border: 1.5px solid #b71c1c;
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .link-divider {
    width: 1px;
    background: #e5d7d7;
    height: 100%;
  }
  .link-title {
    color: #9b1111;
    font-size: 9.2px;
    font-weight: 900;
    text-transform: uppercase;
    line-height: 1.3;
  }
  .link-subtitle {
    margin-top: .7mm;
    color: #2b2b2b;
    font-size: 8.5px;
  }
  .link-url {
    margin-top: 1.1mm;
    display: inline-flex;
    align-items: center;
    gap: 2mm;
    padding: 1.1mm 2mm;
    border-radius: 8px;
    background: #fff3f3;
    color: #9b1111;
    font-size: 8px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .link-note {
    margin-top: 1mm;
    color: #666;
    font-size: 8px;
  }
  .qr-card {
    padding: 2.4mm;
    background: linear-gradient(180deg, #fffefe, #fff7f7);
    display: flex;
    flex-direction: column;
    gap: 2mm;
    justify-content: space-between;
  }
  .qr-head {
    padding: 2.2mm 2.8mm;
    border-radius: 10px;
    background: linear-gradient(90deg, #9b1111, #b71c1c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2mm;
    font-size: 8.9px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  .qr-box {
    padding: 2.2mm;
    border-radius: 12px;
    background: #fff;
    border: 1px solid #ead9d9;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .qr-box img {
    width: 42mm;
    height: 42mm;
    object-fit: contain;
  }
  .qr-icons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1mm;
  }
  .qr-chip {
    text-align: center;
    color: #2b2b2b;
    font-size: 7.1px;
  }
  .qr-chip-icon {
    width: 8mm;
    height: 8mm;
    margin: 0 auto .7mm;
    border-radius: 999px;
    border: 1px solid #dcbcbc;
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .three-col-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 3mm;
  }
  .glance-row {
    display: grid;
    grid-template-columns: 18mm 1px 1fr 1fr;
    gap: 2.4mm;
    align-items: center;
    padding: 2mm 0;
    border-top: 1px solid #eee2e2;
  }
  .glance-row:first-child { border-top: 0; }
  .glance-divider { width: 1px; background: #ead9d9; height: 100%; }
  .glance-icon {
    width: 11mm;
    height: 11mm;
    margin-left: 1mm;
    border-radius: 999px;
    background: #fff1f1;
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .glance-label {
    color: #9b1111;
    font-size: 8.2px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .glance-value {
    color: #2b2b2b;
    font-size: 8.2px;
    font-weight: 600;
    line-height: 1.28;
  }
  .payment-option {
    display: grid;
    grid-template-columns: 12mm 1fr;
    gap: 2.4mm;
    align-items: center;
    padding: 2mm 0;
    border-top: 1px solid #eee2e2;
  }
  .payment-option:first-child { border-top: 0; }
  .payment-option-icon {
    width: 10.5mm;
    height: 10.5mm;
    border-radius: 999px;
    background: #fff3f3;
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 8px;
  }
  .payment-option-text {
    color: #2b2b2b;
    font-size: 8.2px;
    font-weight: 600;
    line-height: 1.3;
  }
  .timeline {
    display: grid;
    gap: 2.4mm;
  }
  .timeline-step {
    display: grid;
    grid-template-columns: 12mm 14mm 1fr;
    gap: 2.4mm;
    align-items: start;
  }
  .timeline-track {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .timeline-number {
    width: 9mm;
    height: 9mm;
    border-radius: 999px;
    background: #fff1f1;
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8.1px;
    font-weight: 900;
  }
  .timeline-line {
    width: 1.2px;
    flex: 1;
    min-height: 9mm;
    background: repeating-linear-gradient(
      to bottom,
      rgba(183,28,28,.35),
      rgba(183,28,28,.35) 3px,
      transparent 3px,
      transparent 6px
    );
    margin-top: 1mm;
  }
  .timeline-card-icon {
    width: 12mm;
    height: 12mm;
    border-radius: 999px;
    background: #fff5f5;
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .timeline-title {
    color: #9b1111;
    font-size: 8.4px;
    font-weight: 900;
    text-transform: uppercase;
    margin-bottom: .4mm;
  }
  .timeline-text {
    color: #2b2b2b;
    font-size: 8.1px;
    line-height: 1.28;
    font-weight: 600;
  }
  .pay-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2mm;
  }
  .pay-card {
    border: 1px solid #eadfdf;
    border-radius: 12px;
    background: #fffdfd;
    padding: 2.4mm;
  }
  .pay-head {
    display: flex;
    align-items: center;
    gap: 2mm;
    margin-bottom: 1.4mm;
  }
  .pay-icon {
    width: 8mm;
    height: 8mm;
    border-radius: 999px;
    background: #fff1f1;
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pay-title {
    color: #9b1111;
    font-size: 8.1px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .pay-lines {
    display: grid;
    gap: .5mm;
    color: #2b2b2b;
    font-size: 7.8px;
    line-height: 1.28;
    font-weight: 600;
  }
  .support-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3mm;
  }
  .notes-box {
    display: grid;
    grid-template-columns: 10mm 1fr;
    gap: 2.4mm;
    border-radius: 12px;
    background: #f8f8f8;
    padding: 2.6mm;
    min-height: 15mm;
  }
  .notes-icon {
    width: 9mm;
    height: 9mm;
    border-radius: 999px;
    background: #fff1f1;
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .notes-text {
    color: #2b2b2b;
    font-size: 8.1px;
    line-height: 1.34;
    white-space: pre-wrap;
  }
  .terms-stack {
    display: grid;
    gap: 2mm;
  }
  .terms-card {
    position: relative;
    display: grid;
    grid-template-columns: 11mm 40mm 1fr;
    gap: 3mm;
    align-items: center;
    padding: 2.6mm 3mm 2.6mm 4.2mm;
  }
  .terms-accent {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 1.5mm;
    border-radius: 12px 0 0 12px;
    background: linear-gradient(180deg, #9b1111, #b71c1c);
  }
  .terms-icon {
    width: 9.5mm;
    height: 9.5mm;
    border-radius: 999px;
    background: #fff3f3;
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .terms-title {
    color: #9b1111;
    font-size: 8.2px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .terms-content {
    color: #2b2b2b;
    font-size: 8.1px;
    line-height: 1.3;
    font-weight: 600;
  }
  .terms-body { line-height: 1.3; }
  .terms-list { margin: 0; padding-left: 16px; }
  .terms-list li { margin: 0 0 .5mm; }
  .footer-brand {
    margin-top: auto;
    padding: 2.4mm 3mm;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 3mm;
    align-items: center;
  }
  .footer-brand-copy {
    display: grid;
    grid-template-columns: 10mm 1fr;
    gap: 2.4mm;
    align-items: center;
  }
  .footer-brand-badge {
    width: 10mm;
    height: 10mm;
    border-radius: 999px;
    background: linear-gradient(180deg, #b71c1c, #9b1111);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .footer-brand-title {
    color: #9b1111;
    font-size: 8.8px;
    font-weight: 900;
  }
  .footer-brand-subtitle {
    color: #2b2b2b;
    font-size: 8.2px;
    margin-top: .3mm;
  }
  .footer-logo {
    color: #9b1111;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    margin-top: 1.3mm;
    padding-top: 1.3mm;
    border-top: 1px solid #ead9d9;
    color: #666;
    font-size: 7.1px;
  }
  .icon-svg { width: 4.4mm; height: 4.4mm; }
  .section-head .icon-svg,
  .floating-icon .icon-svg,
  .badge-pill .icon-svg,
  .timeline-card-icon .icon-svg,
  .brand-mark .icon-svg { width: 5mm; height: 5mm; }
  .meta-icon .icon-svg,
  .glance-icon .icon-svg,
  .pay-icon .icon-svg,
  .link-circle .icon-svg,
  .qr-chip-icon .icon-svg,
  .cost-row-icon .icon-svg,
  .terms-icon .icon-svg,
  .notes-icon .icon-svg,
  .mini-icon .icon-svg,
  .detail-icon .icon-svg,
  .footer-brand-badge .icon-svg { width: 4.1mm; height: 4.1mm; }
  @media print {
    body { background: #fff; }
    .sheet {
      margin: 0;
      page-break-after: always;
      box-shadow: none;
    }
  }
</style>
</head>
<body>
<section class="sheet">
  <div class="page top-strip">
    <div class="hero-card">
      <div class="badge-row">
        <div class="badge-line"></div>
        <div class="badge-pill">
          <span class="icon-badge">${iconSvg("shield")}</span>
          <span>Official Customer Quotation</span>
        </div>
        <div class="badge-line"></div>
      </div>

      <div class="logo-title">
        <div class="brand-mark">
          ${
            assets.letterheadUrl
              ? `<img src="${assets.letterheadUrl}" alt="Betech Solar Solutions" />`
              : `<div class="brand-fallback">BT</div>`
          }
        </div>
        <h1 class="hero-title">${renderTitleWithAccent(data.title)}</h1>
      </div>
      <div class="hero-rule"></div>
      <div class="hero-intro">${escapeHtml(data.intro)}</div>

      <div class="meta-card section-card">
        <div class="meta-cell">
          <div class="meta-icon">${iconSvg("file")}</div>
          <div class="meta-copy">
            <div class="meta-label">Quote Number</div>
            <div class="meta-value">${escapeHtml(data.quoteRef)}</div>
          </div>
        </div>
        <div class="meta-cell">
          <div class="meta-icon">${iconSvg("calendar")}</div>
          <div class="meta-copy">
            <div class="meta-label">Date</div>
            <div class="meta-value">${escapeHtml(data.quotationDateLabel)}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div class="section-card info-card">
        <div class="floating-icon">${iconSvg("user")}</div>
        <div class="card-title">Customer Information</div>
        <div class="card-divider"></div>
        ${renderRows([
          ["user", "Customer Name", data.customer.name],
          ["phone", "Phone", data.customer.phone],
          ["mail", "Email", data.customer.email],
          ["location", "Location", data.customer.location],
        ])}
      </div>
      <div class="section-card info-card">
        <div class="floating-icon">${iconSvg("users")}</div>
        <div class="card-title">Prepared By</div>
        <div class="card-divider"></div>
        ${renderRows([
          ["users", "Team", data.preparedBy.team],
          ["wrench", "Lead Technician", data.preparedBy.leadTechnicianName],
          ["phone", "Technician Phone", data.preparedBy.leadTechnicianPhone],
          ["headset", "Sales Desk", data.preparedBy.salesDesk],
        ])}
      </div>
      <div class="section-card info-card">
        <div class="floating-icon">${iconSvg("building")}</div>
        <div class="card-title">Company Details</div>
        <div class="card-divider"></div>
        ${renderRows([
          ["building", "Company", data.company.name],
          ["id", "Registration", data.company.registrationNo],
          ["file", "KRA PIN", data.company.kraPin],
          ["location", "Office", data.company.office],
        ], "wrap")}
      </div>
    </div>

    <div class="boq-shell">
      <div class="section-head">
        <div class="section-head-icon">${iconSvg("briefcase")}</div>
        <div class="section-head-title">Detailed Bill of Quantities</div>
      </div>
      <div class="section-body" style="padding:0;">
        <table class="boq">
          <thead>
            <tr>
              <th style="width:7%;">#</th>
              <th style="width:43%;">Description</th>
              <th style="width:8%;">Qty</th>
              <th style="width:14%;">Unit Price</th>
              <th style="width:14%;">Amount</th>
              <th style="width:14%;">Warranty</th>
            </tr>
          </thead>
          <tbody>
            ${renderBoqRows(data.items)}
          </tbody>
        </table>
      </div>
    </div>

    <div class="bottom-grid">
      <div class="section-card">
        <div class="section-head">
          <div class="section-head-icon">${iconSvg("wallet")}</div>
          <div class="section-head-title">Cost Breakdown</div>
        </div>
        <div class="section-body">
          ${renderCostRows(costRows)}
          <div class="cost-note">
            ${
              data.items.length === 1 && data.installationTotal <= 0 && data.transportTotal <= 0
                ? "This quotation covers the selected item value only. Optional delivery, transport, or installation can be added separately if required."
                : "Project value reflects the quoted equipment together with any listed delivery, installation, and related project costs."
            }
          </div>
        </div>
      </div>
      <div class="section-card">
        <div class="section-head">
          <div class="section-head-icon">${iconSvg("shield")}</div>
          <div class="section-head-title">Warranty Notes</div>
        </div>
        <div class="section-body">
          ${renderWarrantyNotes(data.warrantyNotes)}
        </div>
      </div>
    </div>

    <div class="footer-brand">
      <div class="footer-brand-copy">
        <div class="footer-brand-badge">${iconSvg("check")}</div>
        <div>
          <div class="footer-brand-title">Betech Solar Solutions - Powering Your World</div>
          <div class="footer-brand-subtitle">Quality products &bull; Expert installation &bull; Reliable support</div>
        </div>
      </div>
      <div class="footer-logo">Betech Solar Solutions</div>
    </div>

    <div class="footer">
      <span>${escapeHtml(data.quoteRef)}</span>
      <span>${escapeHtml(data.company.name)}</span>
      <span>Page 1 of 2</span>
    </div>
  </div>
</section>

<section class="sheet page-break">
  <div class="page top-strip">
    <div class="full-card">
      <div class="section-head">
        <div class="section-head-icon">${iconSvg("globe")}</div>
        <div class="section-head-title">Useful Links</div>
      </div>
      <div class="section-body">
        <div class="links-layout">
          <div class="links-list">
            <div class="link-row">
              <div class="link-circle">${iconSvg("play")}</div>
              <div class="link-divider"></div>
              <div>
                <div class="link-title">${escapeHtml(featuredProjectLabel)}</div>
                <div class="link-subtitle">Paste TikTok, YouTube, or website project link here.</div>
                <div class="link-url">${iconSvg("globe")}<span>${escapeHtml(featuredProjectUrl)}</span></div>
                <div class="link-note">Scan the QR code to open the project link directly on your phone.</div>
              </div>
            </div>
            <div class="link-row">
              <div class="link-circle">${iconSvg("package")}</div>
              <div class="link-divider"></div>
              <div>
                <div class="link-title">View All Our Products</div>
                <div class="link-url">${iconSvg("globe")}<span>${escapeHtml(data.company.website)}</span></div>
              </div>
            </div>
            <div class="link-row">
              <div class="link-circle">${iconSvg("mail")}</div>
              <div class="link-divider"></div>
              <div>
                <div class="link-title">Email Us</div>
                <div class="link-subtitle">${escapeHtml(data.company.email)}</div>
              </div>
            </div>
            <div class="link-row">
              <div class="link-circle">${iconSvg("headset")}</div>
              <div class="link-divider"></div>
              <div>
                <div class="link-title">Technical Sales</div>
                <div class="link-subtitle">jackson@betech.co.ke</div>
              </div>
            </div>
          </div>

          <div class="qr-card">
            <div class="qr-head">${iconSvg("mobile")}<span>Scan To View Project</span></div>
            <div class="qr-box">
              <img src="${featuredProjectQr}" alt="Project QR code" />
            </div>
            <div class="qr-icons">
              <div class="qr-chip">
                <div class="qr-chip-icon">${iconSvg("play")}</div>
                <div>TikTok</div>
              </div>
              <div class="qr-chip">
                <div class="qr-chip-icon">${iconSvg("play")}</div>
                <div>YouTube</div>
              </div>
              <div class="qr-chip">
                <div class="qr-chip-icon">${iconSvg("globe")}</div>
                <div>Website</div>
              </div>
              <div class="qr-chip">
                <div class="qr-chip-icon">${iconSvg("mobile")}</div>
                <div>Mobile</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="three-col-grid">
      <div class="section-card">
        <div class="section-head">
          <div class="section-head-icon">${iconSvg("calendar")}</div>
          <div class="section-head-title">At A Glance</div>
        </div>
        <div class="section-body">
          <div class="glance-row">
            <div class="glance-icon">${iconSvg("calendar")}</div>
            <div class="glance-divider"></div>
            <div class="glance-label">Quotation Date</div>
            <div class="glance-value">${escapeHtml(data.quotationDateLabel)}</div>
          </div>
          <div class="glance-row">
            <div class="glance-icon">${iconSvg("wallet")}</div>
            <div class="glance-divider"></div>
            <div class="glance-label">Payment Terms</div>
            <div class="glance-value">${escapeHtml(data.paymentTermsLabel)}</div>
          </div>
          <div class="glance-row">
            <div class="glance-icon">${iconSvg("truck")}</div>
            <div class="glance-divider"></div>
            <div class="glance-label">Delivery</div>
            <div class="glance-value">${escapeHtml(data.deliveryText)}</div>
          </div>
          <div class="glance-row">
            <div class="glance-icon">${iconSvg("wrench")}</div>
            <div class="glance-divider"></div>
            <div class="glance-label">Installation</div>
            <div class="glance-value">${escapeHtml(data.installationText)}</div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-head">
          <div class="section-head-icon">${iconSvg("wallet")}</div>
          <div class="section-head-title">Payment Terms</div>
        </div>
        <div class="section-body">
          <div class="payment-option">
            <div class="payment-option-icon">${iconSvg("wallet")}</div>
            <div class="payment-option-text">Full payment before installation.</div>
          </div>
          <div class="payment-option">
            <div class="payment-option-icon">30%</div>
            <div class="payment-option-text">30% deposit with balance after installation.</div>
          </div>
          <div class="payment-option">
            <div class="payment-option-icon">${iconSvg("shield")}</div>
            <div class="payment-option-text">Full payment after installation where approved by management.</div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-head">
          <div class="section-head-icon">${iconSvg("check")}</div>
          <div class="section-head-title">Approval &amp; Next Steps</div>
        </div>
        <div class="section-body">
          ${renderApprovalTimeline()}
        </div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-head">
        <div class="section-head-icon">${iconSvg("briefcase")}</div>
        <div class="section-head-title">Payment Methods</div>
      </div>
      <div class="section-body">
        <div class="pay-grid">
          ${renderPaymentMethods(data.paymentMethods)}
        </div>
      </div>
    </div>

    <div class="support-grid">
      <div class="section-card">
        <div class="section-head">
          <div class="section-head-icon">${iconSvg("headset")}</div>
          <div class="section-head-title">Contact &amp; After-Sales Support</div>
        </div>
        <div class="section-body">
          ${renderRows([
            ["phone", "Sales Desk", data.company.salesDesk],
            ["headset", "Technical Support", "0705663175"],
            ["mail", "Email", data.company.email],
            ["globe", "Website", data.company.website],
            ["location", "Office", data.company.office],
          ])}
          <div style="margin-top:2.5mm;">
            ${renderIconList(data.afterSalesSupport, "headset")}
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-head">
          <div class="section-head-icon">${iconSvg("file")}</div>
          <div class="section-head-title">Customer Notes</div>
        </div>
        <div class="section-body">
          <div class="notes-box">
            <div class="notes-icon">${iconSvg("edit")}</div>
            <div class="notes-text">${escapeHtml(data.customerNotes || "No additional customer notes were entered for this quotation.")}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="full-card">
      <div class="section-head">
        <div class="section-head-icon">${iconSvg("shield")}</div>
        <div class="section-head-title">Terms &amp; Conditions</div>
      </div>
      <div class="section-body">
        <div class="terms-stack">
          ${renderTermsCards(data.termsAndConditions)}
        </div>
      </div>
    </div>

    <div class="footer-brand">
      <div class="footer-brand-copy">
        <div class="footer-brand-badge">${iconSvg("check")}</div>
        <div>
          <div class="footer-brand-title">Betech Solar Solutions - Your Trusted Solar Partner</div>
          <div class="footer-brand-subtitle">Quality products &bull; Expert installation &bull; Reliable support</div>
        </div>
      </div>
      <div class="footer-logo">Betech Solar Solutions</div>
    </div>

    <div class="footer">
      <span>${escapeHtml(data.quoteRef)}</span>
      <span>${escapeHtml(data.company.name)}</span>
      <span>Page 2 of 2</span>
    </div>
  </div>
</section>
</body>
</html>`;
}
