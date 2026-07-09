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
  | "check"
  | "settings"
  | "book"
  | "clipboard";

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
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 3.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 0 1 6.1 3.4l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 20.6 6l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"/>',
    book:
      '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5V21"/><path d="M12 7h5"/><path d="M12 11h5"/><path d="M12 15h5"/><path d="M8 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
    clipboard:
      '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="m9.5 17 1.5 1.5 3.5-3.5"/>',
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

function renderSupportList(items: readonly string[]) {
  const iconForSupportItem = (item: string, index: number): IconName => {
    const normalized = item.toLowerCase();
    if (normalized.includes("telephone") || normalized.includes("whatsapp")) return "headset";
    if (normalized.includes("troubleshooting") || normalized.includes("remote")) return "settings";
    if (normalized.includes("warranty")) return "shield";
    if (normalized.includes("training") || normalized.includes("guidance")) return "book";
    if (normalized.includes("spare parts")) return "package";
    if (normalized.includes("maintenance")) return "wrench";
    if (normalized.includes("site revisit")) return "clipboard";
    return index === 0 ? "headset" : "check";
  };

  const descriptionForSupportItem = (item: string) => {
    const normalized = item.toLowerCase();
    if (normalized.includes("telephone") || normalized.includes("whatsapp")) {
      return "Get quick help and expert guidance whenever you need it.";
    }
    if (normalized.includes("troubleshooting") || normalized.includes("remote")) {
      return "Our team helps diagnose and resolve issues remotely for your convenience.";
    }
    if (normalized.includes("warranty")) {
      return "We provide warranty assistance and genuine support for eligible products.";
    }
    if (normalized.includes("training") || normalized.includes("guidance")) {
      return "Learn how to use your system efficiently and get the best performance.";
    }
    if (normalized.includes("spare parts")) {
      return "We provide original spare parts and replacement support.";
    }
    if (normalized.includes("maintenance")) {
      return "Receive expert recommendations to keep your system running smoothly.";
    }
    if (normalized.includes("site revisit")) {
      return "Our team can schedule a site visit when physical support is required.";
    }
    return "";
  };

  const renderSupportItem = (item: string, index: number) => `
    <div class="support-row">
      <div class="support-icon">${iconSvg(iconForSupportItem(item, index))}</div>
      <div class="support-divider"></div>
      <div class="support-copy">
        <div class="support-title">${escapeHtml(item)}</div>
        ${
          descriptionForSupportItem(item)
            ? `<div class="support-description">${escapeHtml(descriptionForSupportItem(item))}</div>`
            : ""
        }
        ${
          item.toLowerCase().includes("warranty")
            ? '<div class="support-highlight">Technical support no. 0705663175</div>'
            : ""
        }
      </div>
    </div>
  `;

  const leftColumn = items.slice(0, 3);
  const rightColumn = items.slice(3);

  return `
    <div class="support-columns">
      <div class="support-list">
        ${leftColumn.map((item, index) => renderSupportItem(item, index)).join("")}
      </div>
      <div class="support-list">
        ${rightColumn.map((item, index) => renderSupportItem(item, leftColumn.length + index)).join("")}
      </div>
    </div>
  `;
}

function renderContactInformationGrid(rows: Array<[IconName, string, string]>) {
  return `
    <div class="contact-grid">
      ${rows
        .filter(([, , value]) => String(value || "").trim())
        .map(
          ([icon, label, value]) => `
            <div class="contact-item">
              <div class="contact-icon">${iconSvg(icon)}</div>
              <div class="contact-divider"></div>
              <div class="contact-copy">
                <div class="contact-label">${escapeHtml(label)}</div>
                <div class="contact-value">${escapeHtml(value)}</div>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
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
  const splitItem = (name: string, description: string | null | undefined) => {
    const trimmedName = String(name || "").trim();
    const trimmedDescription = String(description || "").trim();

    if (trimmedDescription) {
      return { title: trimmedName, subtitle: trimmedDescription };
    }

    if (trimmedName.includes(" - ")) {
      const [head, ...rest] = trimmedName.split(" - ");
      return {
        title: head.trim(),
        subtitle: rest.join(" - ").split(" + ").map((part) => part.trim()).filter(Boolean).join(" • "),
      };
    }

    if (trimmedName.includes(" + ")) {
      const [head, ...rest] = trimmedName.split(" + ");
      return {
        title: head.trim(),
        subtitle: rest.map((part) => part.trim()).filter(Boolean).join(" • "),
      };
    }

    return { title: trimmedName, subtitle: "" };
  };

  return items
    .map((item, index) => {
      const summary = splitItem(item.name, item.description);
      const warrantyText = String(item.warrantyText || "").trim();
      return `
        <tr class="boq-row ${index % 2 === 0 ? "boq-row-even" : "boq-row-odd"}">
          <td class="center">${item.index}</td>
          <td>
            <div class="item-name">${escapeHtml(summary.title)}</div>
            ${summary.subtitle ? `<div class="item-desc">${escapeHtml(summary.subtitle)}</div>` : ""}
          </td>
          <td class="center">${escapeHtml(item.quantity)}</td>
          <td class="right">${escapeHtml(formatMoney(item.unitPrice))}</td>
          <td class="right amount-cell">${escapeHtml(formatMoney(item.amount))}</td>
          <td>${warrantyText ? `<span class="warranty-pill">${escapeHtml(warrantyText)}</span>` : ""}</td>
        </tr>
      `;
    })
    .join("");
}

function renderCostRows(rows: ReadonlyArray<readonly [string, number]>) {
  const iconByLabel = (label: string): IconName => {
    if (/discount/i.test(label)) return "alert";
    if (/final amount/i.test(label)) return "wallet";
    if (/project cost/i.test(label)) return "package";
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
    [
      "package",
      "Returns & Refunds",
      "Returns, exchanges, and product upgrades may be accommodated within a reasonable time after installation, subject to inspection and approval. Refunds are not available once installation has been completed.",
    ],
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

function normalizeProjectPortfolioLink(url?: string | null) {
  const text = String(url || "").trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return null;
  }
}

function isDefaultProjectPortfolioLink(url?: string | null) {
  const normalized = normalizeProjectPortfolioLink(url);
  if (!normalized) return true;
  const defaults = new Set([
    "https://www.tiktok.com/@betechsolarprojects",
    "https://www.betech.co.ke/projects",
  ]);
  return defaults.has(normalized);
}

function getProjectQrCopy(projectLink?: string | null) {
  if (isDefaultProjectPortfolioLink(projectLink)) {
    return {
      leftTitle: "VIEW OUR RECENT SOLAR PROJECTS",
      leftBody: "See real installations completed by Betech Solar Solutions across Kenya.",
      leftNote: "Scan the QR code or click the link below to view our recent solar projects and completed installations.",
      qrHeader: "SEE OUR RECENT PROJECTS",
      qrBody: "Scan the QR code to view our recent solar projects and completed installations.",
    };
  }

  return {
    leftTitle: "VIEW A SIMILAR INSTALLATION",
    leftBody: "See a similar solar installation completed by Betech Solar Solutions.",
    leftNote: "Scan the QR code or click the link below to view this similar project directly.",
    qrHeader: "SEE A SIMILAR PROJECT",
    qrBody: "Scan the QR code to view a similar solar project completed by Betech Solar Solutions.",
  };
}

type QuotationLayoutBlock = {
  id: string;
  html: string;
};

function renderQuotationBlocks(blocks: QuotationLayoutBlock[]) {
  return blocks
    .map(
      (block) => `
        <section class="quote-block" data-block-id="${escapeHtml(block.id)}">
          ${block.html}
        </section>
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
  const serviceCostRows: Array<readonly [string, number]> = [["Subtotal", data.subtotal]];
  if (data.discountAmount > 0) {
    serviceCostRows.push(["Discount", -data.discountAmount]);
  }
  serviceCostRows.push(["Final quoted amount", data.grandTotal]);
  const costRows = serviceCostRows;
  const featuredProjectUrl = data.similarProjectUrl || data.company.projectsUrl;
  const projectQrCopy = getProjectQrCopy(featuredProjectUrl);
  const featuredProjectQr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(featuredProjectUrl)}`;
  const feeStateNotes = [
    data.deliveryMode === "INCLUDED"
      ? "Delivery included."
      : data.deliveryMode === "CHARGED"
        ? "Delivery charged separately."
      : "Delivery not included.",
    data.installationMode === "INCLUDED"
      ? "Installation included."
      : data.installationMode === "CHARGED"
        ? "Installation charged separately."
        : "Installation not included.",
  ].join(" ");
  const compactQuotationClass = data.items.length <= 4 ? "compact-quotation" : "";

  const postBoqBlocks: QuotationLayoutBlock[] = [
    {
      id: "cost-warranty",
      html: `
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
                    ? `This quotation covers the selected item value only. ${feeStateNotes}`
                    : `Project value reflects the quoted equipment together with any listed delivery, installation, and related project costs. ${feeStateNotes}`
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
      `,
    },
    {
      id: "useful-links",
      html: `
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
                    <div class="link-title">${escapeHtml(projectQrCopy.leftTitle)}</div>
                    <div class="link-subtitle">${escapeHtml(projectQrCopy.leftBody)}</div>
                    <div class="link-note">${escapeHtml(projectQrCopy.leftNote)}</div>
                    <div class="link-url">${iconSvg("globe")}<span>${escapeHtml(featuredProjectUrl)}</span></div>
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
                <div class="qr-head">${iconSvg("mobile")}<span>${escapeHtml(projectQrCopy.qrHeader)}</span></div>
                <div class="qr-caption">${escapeHtml(projectQrCopy.qrBody)}</div>
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
      `,
    },
    {
      id: "glance-payment-approval",
      html: `
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
      `,
    },
    {
      id: "payment-methods",
      html: `
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
      `,
    },
    {
      id: "contact-information",
      html: `
        <div class="section-card">
          <div class="section-head">
            <div class="section-head-icon">${iconSvg("headset")}</div>
            <div class="section-head-title">Contact Information</div>
          </div>
          <div class="section-body">
            ${renderContactInformationGrid([
              ["phone", "Sales Desk", data.company.salesDesk],
              ["headset", "Technical Support", "0705663175"],
              ["mail", "Email", data.company.email],
              ["globe", "Website", data.company.website],
              ["location", "Office", data.company.office],
            ])}
          </div>
        </div>
      `,
    },
    {
      id: "support-notes",
      html: `
        <div class="support-grid">
          <div class="section-card">
            <div class="section-head">
              <div class="section-head-icon">${iconSvg("headset")}</div>
              <div class="section-head-title">After-Sales Support</div>
            </div>
            <div class="section-body">
              ${renderSupportList(data.afterSalesSupport)}
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
                <div class="notes-text">${escapeHtml(data.customerNotes || "This quotation covers the supply, delivery, installation, testing and commissioning of a solar home system solution based on your stated requirements.")}</div>
              </div>
            </div>
          </div>
        </div>
      `,
    },
    {
      id: "terms-and-conditions",
      html: `
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
      `,
    },
  ];

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
  .quotation-document {
    width: 210mm;
    margin: 0 auto;
    background: #fafafa;
    padding: 5mm;
    display: flex;
    flex-direction: column;
    gap: 2.2mm;
  }
  .document-body {
    display: flex;
    flex-direction: column;
    gap: 2.2mm;
  }
  .quote-block {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 0;
  }
  .quote-block.boq-block,
  .quote-block[data-block-id="boq"] {
    break-inside: auto;
    page-break-inside: auto;
  }
  .compact-quotation .quote-block {
    margin-bottom: 0;
  }
  .compact-quotation .section-head {
    padding-top: 1.7mm;
    padding-bottom: 1.7mm;
  }
  .compact-quotation .section-body {
    padding-top: 1.9mm;
    padding-bottom: 1.9mm;
  }
  .compact-quotation .hero-card { padding: 22px 28px; }
  .compact-quotation .info-card { padding: 18px 18px 14px; }
  .compact-quotation .links-layout,
  .compact-quotation .three-col-grid,
  .compact-quotation .support-grid,
  .compact-quotation .pay-grid,
  .compact-quotation .terms-stack,
  .compact-quotation .support-columns,
  .compact-quotation .document-body {
    gap: 1.5mm;
  }
  .compact-quotation .boq td { padding: 10px 12px; }
  .compact-quotation .link-row,
  .compact-quotation .payment-option,
  .compact-quotation .glance-row,
  .compact-quotation .support-row,
  .compact-quotation .contact-item,
  .compact-quotation .terms-card,
  .compact-quotation .cost-row {
    padding-top: 1.5mm;
    padding-bottom: 1.5mm;
  }
  .compact-quotation .qr-box img {
    width: 38mm;
    height: 38mm;
  }
  .compact-quotation .qr-head {
    padding-top: 1.7mm;
    padding-bottom: 1.7mm;
  }
  .top-strip {
    padding-top: 1.6mm;
  }
  .hero-card,
  .section-card,
  .mini-card,
  .qr-card,
  .terms-card,
  .footer-brand {
    border-radius: 12px;
    background: #ffffff;
    border: 1px solid #e7e7e7;
    box-shadow: 0 2px 8px rgba(0,0,0,.05);
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .boq-shell {
    border-radius: 12px;
    background: #ffffff;
    border: 1px solid #e7e7e7;
    box-shadow: 0 2px 8px rgba(0,0,0,.05);
    break-inside: auto;
    page-break-inside: auto;
  }
  .hero-card {
    padding: 2mm 3.6mm 2.8mm;
    text-align: center;
    background:
      radial-gradient(circle at top right, rgba(155,17,17,0.05), transparent 30%),
      linear-gradient(180deg, #ffffff 0%, #fffdfd 100%);
  }
  .badge-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 2.2mm;
    margin-bottom: 2.2mm;
  }
  .badge-line {
    height: 2px;
    background: linear-gradient(90deg, #9b1111, rgba(155,17,17,0.08));
    border-radius: 999px;
  }
  .badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 2.2mm;
    padding: 1.9mm 3.8mm;
    border-radius: 999px;
    background: linear-gradient(90deg, #9b1111, #b71c1c);
    color: #fff;
    font-weight: 800;
    font-size: 8px;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .badge-pill .icon-badge {
    width: 7.4mm;
    height: 7.4mm;
    border-radius: 999px;
    background: #fff;
    color: #9b1111;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .letterhead-block {
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0 auto 1.4mm;
    max-width: 170mm;
  }
  .brand-mark {
    width: 112mm;
    height: 42mm;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9b1111;
  }
  .brand-mark img {
    width: auto;
    max-width: 112mm;
    max-height: 42mm;
    object-fit: contain;
  }
  .brand-fallback {
    width: 100%;
    height: 100%;
    border-radius: 10px;
    background: rgba(155,17,17,0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 900;
    letter-spacing: .08em;
  }
  .hero-title {
    margin: 0;
    font-size: 18.5px;
    line-height: 1.03;
    font-weight: 900;
    color: #202833;
    text-transform: uppercase;
    letter-spacing: -.03em;
    text-align: center;
    max-width: 178mm;
    margin-left: auto;
    margin-right: auto;
  }
  .hero-title .accent { color: #b71c1c; }
  .meta-card {
    margin: 1.6mm auto 0;
    max-width: 104mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    overflow: hidden;
  }
  .meta-cell {
    display: flex;
    align-items: center;
    gap: 3mm;
    padding: 2.2mm 3.1mm;
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
    font-size: 9.3px;
    font-weight: 800;
  }
  .info-grid {
    display: grid;
    grid-template-columns: 1.02fr 1.04fr 1.12fr;
    gap: 2.2mm;
  }
  .info-card {
    padding: 3.6mm 3mm 2.8mm;
    position: relative;
  }
  .floating-icon {
    position: absolute;
    left: 50%;
    top: -7mm;
    transform: translateX(-50%);
    width: 13mm;
    height: 13mm;
    border-radius: 999px;
    background: linear-gradient(180deg, #b71c1c, #9b1111);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 18px rgba(155,17,17,.22);
  }
  .card-title {
    margin-top: 3.2mm;
    text-align: center;
    color: #9b1111;
    font-size: 9.3px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .card-divider {
    width: 20mm;
    height: 1.8px;
    margin: 1.5mm auto 2mm;
    background: linear-gradient(90deg, transparent, #b71c1c, transparent);
  }
  .detail-row {
    display: grid;
    grid-template-columns: 7mm 30mm minmax(0, 1fr);
    align-items: center;
    gap: 2mm;
    padding: 1.5mm 0;
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
    word-break: normal;
    overflow-wrap: normal;
  }
  .detail-value.wrap {
    white-space: pre-line;
    overflow-wrap: break-word;
  }
  .section-head {
    display: flex;
    align-items: center;
    gap: 2.6mm;
    padding: 2.6mm 3mm;
    border-radius: 12px 12px 0 0;
    background: linear-gradient(90deg, #9b1111, #b71c1c);
    color: #fff;
    break-after: avoid;
    page-break-after: avoid;
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
  .section-body { padding: 2.6mm; }
  .boq-shell { overflow: visible; }
  .boq {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    break-inside: auto;
    page-break-inside: auto;
  }
  .boq-row {
    break-inside: avoid;
    page-break-inside: avoid;
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
    padding: 1.8mm 2mm;
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
    line-height: 1.22;
  }
  .item-desc {
    margin-top: .5mm;
    color: #666;
    font-size: 7.4px;
    line-height: 1.18;
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
    white-space: nowrap;
  }
  .bottom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2.2mm;
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
    margin-top: 1.1mm;
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
    gap: 2.2mm;
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
  .qr-caption {
    color: #2b2b2b;
    font-size: 8.4px;
    line-height: 1.35;
    text-align: center;
    padding: 0 .8mm;
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
    gap: 2.2mm;
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
    grid-template-columns: 1.45fr .95fr;
    gap: 2.2mm;
    align-items: start;
  }
  .contact-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0;
  }
  .contact-item {
    display: grid;
    grid-template-columns: 13mm 1px 1fr;
    gap: 3mm;
    align-items: center;
    padding: 3mm 1.2mm;
    border-top: 1px solid #efe1e1;
  }
  .contact-item:nth-child(-n+2) { border-top: 0; }
  .contact-icon {
    width: 11.5mm;
    height: 11.5mm;
    margin-left: 1mm;
    border-radius: 999px;
    background: linear-gradient(180deg, #fff8f8, #fff1f1);
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #f1dede;
  }
  .contact-divider {
    width: 1px;
    background: linear-gradient(180deg, rgba(155,17,17,.18), rgba(183,28,28,.9), rgba(155,17,17,.18));
    height: 100%;
    min-height: 11mm;
  }
  .contact-copy {
    display: grid;
    gap: .6mm;
  }
  .contact-label {
    color: #202833;
    font-size: 8.8px;
    font-weight: 800;
  }
  .contact-value {
    color: #9b1111;
    font-size: 8.6px;
    line-height: 1.32;
    font-weight: 800;
    word-break: break-word;
  }
  .support-columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 3mm;
  }
  .support-list {
    display: grid;
    gap: 0;
  }
  .support-row {
    display: grid;
    grid-template-columns: 16mm 1px 1fr;
    gap: 3mm;
    align-items: start;
    padding: 2.4mm 0;
    border-top: 1px solid #efe1e1;
  }
  .support-row:first-child { border-top: 0; }
  .support-icon {
    width: 13mm;
    height: 13mm;
    margin-left: 1mm;
    border-radius: 10px;
    background: linear-gradient(180deg, #fff8f8, #fff1f1);
    color: #9b1111;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #f1dede;
  }
  .support-divider {
    width: 1px;
    background: linear-gradient(180deg, rgba(155,17,17,.18), rgba(183,28,28,.95), rgba(155,17,17,.18));
    height: 100%;
    min-height: 11mm;
  }
  .support-copy {
    display: grid;
    gap: .8mm;
  }
  .support-title {
    color: #202833;
    font-size: 8.8px;
    line-height: 1.26;
    font-weight: 700;
  }
  .support-description {
    color: #2b2b2b;
    font-size: 7.9px;
    line-height: 1.34;
    font-weight: 500;
  }
  .support-highlight {
    color: #9b1111;
    font-size: 8.2px;
    line-height: 1.28;
    font-weight: 800;
  }
  .notes-box {
    display: grid;
    grid-template-columns: 10mm 1fr;
    gap: 2.4mm;
    border-radius: 12px;
    background: #f8f8f8;
    padding: 2.6mm;
    min-height: 100%;
    align-content: start;
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
    margin-top: .8mm;
    padding: 2mm 2.8mm;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 3mm;
    align-items: center;
  }
  .page-spacer {
    flex: 1 1 auto;
    min-height: 0;
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
    font-size: 9.4px;
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
    .quotation-document { margin: 0; box-shadow: none; }
  }
</style>
</head>
<body>
<main class="quotation-document ${compactQuotationClass}">
  <div class="document-body top-strip">
    <div class="hero-card">
      <div class="letterhead-block">
        <div class="brand-mark">
          ${
            assets.letterheadUrl
              ? `<img src="${assets.letterheadUrl}" alt="Betech Solar Solutions" />`
              : `<div class="brand-fallback">BT</div>`
          }
        </div>
      </div>

      <div class="badge-row">
        <div class="badge-line"></div>
        <div class="badge-pill">
          <span class="icon-badge">${iconSvg("shield")}</span>
          <span>Official Customer Quotation</span>
        </div>
        <div class="badge-line"></div>
      </div>
      <h1 class="hero-title">${renderTitleWithAccent(data.title)}</h1>

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
          ["users", "Sales Person", data.preparedBy.team],
          ["wrench", "Lead Technician", data.preparedBy.leadTechnicianName],
          ["phone", "Technical Support", data.preparedBy.leadTechnicianPhone],
          ["headset", "Sales Desk", data.preparedBy.salesDesk],
        ], "wrap")}
      </div>
      <div class="section-card info-card">
        <div class="floating-icon">${iconSvg("building")}</div>
        <div class="card-title">Company Details</div>
        <div class="card-divider"></div>
        ${renderRows([
          ["building", "Company", data.company.name],
          ["id", "Registration", data.company.registrationNo],
          ["file", "KRA PIN", data.company.kraPin],
          ["location", "Office", data.company.office.replace(/,\s*/g, ",\n")],
        ], "wrap")}
      </div>
    </div>

    <section class="quote-block boq-block" data-block-id="boq">
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
    </section>

    ${renderQuotationBlocks(postBoqBlocks)}
  </div>
</main>
</body>
</html>`;
}
