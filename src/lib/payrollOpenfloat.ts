import * as fs from "node:fs";
import * as path from "node:path";

const CFB = require("cfb");

import type { TradingPeriod } from "@/lib/tradingPeriod";
import {
  OPENFLOAT_ALLOWED_TYPES,
  OPENFLOAT_HEADERS,
  buildOpenfloatReviewRow,
  type OpenfloatReviewRow,
} from "@/lib/payrollOpenfloatShared";

const OPENFLOAT_TEMPLATE_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "assets",
  "openfloat-transactions-template.xlsx",
);

const TEMPLATE_VISIBLE_ROWS = 200;
const TEMPLATE_VALIDATION_LAST_ROW = 1000;

type SharedStringsState = {
  map: Map<string, number>;
  values: string[];
};

function createSharedStringsState(): SharedStringsState {
  return { map: new Map<string, number>(), values: [] };
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function addSharedString(state: SharedStringsState, value: string) {
  const existing = state.map.get(value);
  if (typeof existing === "number") return existing;
  const index = state.values.length;
  state.values.push(value);
  state.map.set(value, index);
  return index;
}

function buildSharedStringsXml(state: SharedStringsState) {
  const items = state.values
    .map((value) => `<si><t>${escapeXml(value)}</t></si>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${state.values.length}" uniqueCount="${state.values.length}">${items}</sst>`;
}

function makeSharedStringCell(ref: string, index: number, style?: number) {
  return `<c r="${ref}"${typeof style === "number" ? ` s="${style}"` : ""} t="s"><v>${index}</v></c>`;
}

function makeNumberCell(ref: string, value: number, style?: number) {
  return `<c r="${ref}"${typeof style === "number" ? ` s="${style}"` : ""}><v>${Number(value || 0)}</v></c>`;
}

function buildAllowedTypesSheetXml(shared: SharedStringsState) {
  const rows = OPENFLOAT_ALLOWED_TYPES.map((value, index) => {
    const rowNumber = index + 1;
    return `<row r="${rowNumber}">${makeSharedStringCell(`A${rowNumber}`, addSharedString(shared, value), 0)}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="utf-8"?><worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:A${OPENFLOAT_ALLOWED_TYPES.length}" /><sheetViews><sheetView workbookViewId="0" /></sheetViews><sheetFormatPr defaultRowHeight="15" /><sheetData>${rows}</sheetData><headerFooter /></worksheet>`;
}

function buildAccountsSheetXml(rows: OpenfloatReviewRow[], shared: SharedStringsState) {
  const visibleRows = Math.max(TEMPLATE_VISIBLE_ROWS, rows.length + 1);

  const headerRow = `<row r="1">${[
    makeSharedStringCell("A1", addSharedString(shared, OPENFLOAT_HEADERS[0]), 0),
    makeSharedStringCell("B1", addSharedString(shared, OPENFLOAT_HEADERS[1]), 1),
    makeSharedStringCell("C1", addSharedString(shared, OPENFLOAT_HEADERS[2]), 1),
    makeSharedStringCell("D1", addSharedString(shared, OPENFLOAT_HEADERS[3]), 1),
    makeSharedStringCell("E1", addSharedString(shared, OPENFLOAT_HEADERS[4]), 0),
    makeSharedStringCell("F1", addSharedString(shared, OPENFLOAT_HEADERS[5]), 1),
    makeSharedStringCell("G1", addSharedString(shared, OPENFLOAT_HEADERS[6]), 0),
    makeSharedStringCell("H1", addSharedString(shared, OPENFLOAT_HEADERS[7]), 0),
  ].join("")}</row>`;

  const bodyRows = Array.from({ length: visibleRows - 1 }, (_, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const row = rows[rowIndex];

    if (!row) {
      return `<row r="${rowNumber}"><c r="B${rowNumber}" s="1"/><c r="C${rowNumber}" s="1"/><c r="D${rowNumber}" s="1"/><c r="F${rowNumber}" s="1"/></row>`;
    }

    return `<row r="${rowNumber}">${[
      makeSharedStringCell(`A${rowNumber}`, addSharedString(shared, row.accountType)),
      makeSharedStringCell(`B${rowNumber}`, addSharedString(shared, row.accountName), 1),
      makeSharedStringCell(`C${rowNumber}`, addSharedString(shared, row.accountNumber), 1),
      makeSharedStringCell(`D${rowNumber}`, addSharedString(shared, row.tillOrPaybillNumber), 1),
      makeSharedStringCell(`E${rowNumber}`, addSharedString(shared, row.tillOrPaybillBusinessName)),
      makeSharedStringCell(`F${rowNumber}`, addSharedString(shared, row.notificationPhoneNumber), 1),
      makeNumberCell(`G${rowNumber}`, row.amount),
      makeSharedStringCell(`H${rowNumber}`, addSharedString(shared, row.remark)),
    ].join("")}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="utf-8"?><worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:H${visibleRows}" /><sheetViews><sheetView workbookViewId="0" /></sheetViews><sheetFormatPr defaultRowHeight="15" /><cols><col min="1" max="1" width="13.339592933654785" customWidth="1"/><col min="2" max="2" width="14.327874183654785" customWidth="1"/><col min="3" max="3" width="16.313644409179688" customWidth="1"/><col min="4" max="4" width="20.25858497619629" customWidth="1"/><col min="5" max="5" width="26.302854537963867" customWidth="1"/><col min="6" max="6" width="25.532485961914062" customWidth="1"/><col min="7" max="7" width="9.140625" customWidth="1"/><col min="8" max="8" width="9.140625" customWidth="1"/></cols><sheetData>${headerRow}${bodyRows}</sheetData><dataValidations count="1"><dataValidation type="list" sqref="A2:A${TEMPLATE_VALIDATION_LAST_ROW}" showErrorMessage="1" errorStyle="warning" errorTitle="An invalid value was entered" error="Select a value from the list"><formula1>='Allowed Types'!$A$1:$A$${OPENFLOAT_ALLOWED_TYPES.length}</formula1></dataValidation></dataValidations><headerFooter /></worksheet>`;
}

function replaceZipEntry(cfb: any, entryPath: string, content: Buffer) {
  const entry = CFB.find(cfb, entryPath);
  if (entry) {
    entry.content = content;
    entry.size = content.length;
    return;
  }
  CFB.utils.cfb_add(cfb, entryPath.replace(/^Root Entry\//, ""), content, { unsafe: true });
}

export async function buildOpenfloatReviewRows(period: TradingPeriod) {
  const [{ prisma }, { buildPayrollRow }, { applyCanonicalPayrollOverrides }, { payrollEligibleUserWhere }] =
    await Promise.all([
      import("@/lib/prisma"),
      import("@/lib/adminPayroll"),
      import("@/lib/payrollCanonical"),
      import("@/lib/payrollEligibility"),
    ]);

  const attendants = await prisma.user.findMany({
    where: payrollEligibleUserWhere(),
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      attendantCategory: true,
      isActive: true,
      bankName: true,
      bankAccountNumber: true,
      payoutMethod: true,
      payoutAccountName: true,
      mobileMoneyPhoneNumber: true,
      tillPaybillNumber: true,
      tillPaybillBusinessName: true,
      paybillAccountNumber: true,
      notificationPhoneNumber: true,
    },
  });

  const rows = await Promise.all(
    attendants.map(async (attendant) => {
      const payrollRow = await applyCanonicalPayrollOverrides(await buildPayrollRow(attendant, period), period);
      return buildOpenfloatReviewRow(attendant, payrollRow.netPay, period);
    }),
  );

  return rows;
}

export function buildOpenfloatWorkbook(rows: OpenfloatReviewRow[]) {
  const exportRows = rows.filter((row) => !row.isSkipped);
  const templateBuffer = fs.readFileSync(OPENFLOAT_TEMPLATE_PATH);
  const cfb = CFB.read(templateBuffer, { type: "buffer" });
  const shared = createSharedStringsState();

  const accountsSheetXml = buildAccountsSheetXml(exportRows, shared);
  const allowedTypesSheetXml = buildAllowedTypesSheetXml(shared);
  const sharedStringsXml = buildSharedStringsXml(shared);

  replaceZipEntry(cfb, "Root Entry/xl/worksheets/sheet1.xml", Buffer.from(accountsSheetXml, "utf8"));
  replaceZipEntry(cfb, "Root Entry/xl/worksheets/sheet2.xml", Buffer.from(allowedTypesSheetXml, "utf8"));
  replaceZipEntry(cfb, "Root Entry/xl/sharedStrings.xml", Buffer.from(sharedStringsXml, "utf8"));

  return CFB.write(cfb, { type: "buffer", fileType: "zip" }) as Buffer;
}

export function workbookToBuffer(workbook: Buffer) {
  return workbook;
}

export function renderOpenfloatReviewHtml(input: { period: TradingPeriod; rows: OpenfloatReviewRow[] }) {
  const { period, rows } = input;
  const totals = rows.reduce(
    (acc, row) => {
      if (!row.isSkipped && row.isValid) {
        acc.totalAmount += row.amount;
        acc.validCount += 1;
      } else if (row.isSkipped) {
        acc.skippedCount += 1;
      } else {
        acc.invalidCount += 1;
      }
      return acc;
    },
    { totalAmount: 0, validCount: 0, invalidCount: 0, skippedCount: 0 },
  );

  const bodyRows = rows
    .map((row) => {
      const issues = row.isSkipped
        ? row.skipReason || "Skipped"
        : row.validationErrors.length
          ? row.validationErrors.join("; ")
          : "Ready";
      return `
        <tr class="${row.isSkipped ? "skip" : row.isValid ? "ok" : "bad"}">
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.accountType || "Missing")}</td>
          <td>${escapeHtml(row.accountName)}</td>
          <td>${escapeHtml(row.accountNumber)}</td>
          <td>${escapeHtml(row.tillOrPaybillNumber)}</td>
          <td>${escapeHtml(row.tillOrPaybillBusinessName)}</td>
          <td>${escapeHtml(row.notificationPhoneNumber)}</td>
          <td class="num">${formatAmount(row.amount)}</td>
          <td>${escapeHtml(issues)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Openfloat payout review ${escapeHtml(period.key)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
        h1 { margin: 0 0 8px; font-size: 24px; }
        p { margin: 0 0 8px; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
        .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; background: #f8fafc; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; text-align: left; }
        th { background: #e2e8f0; }
        .num { text-align: right; }
        .ok { background: #f0fdf4; }
        .bad { background: #fff1f2; }
        .skip { background: #f8fafc; color: #64748b; }
      </style>
    </head>
    <body>
      <h1>Openfloat payroll payout review</h1>
      <p>Period: ${escapeHtml(period.label)}</p>
      <div class="summary">
        <div class="card"><strong>Total amount</strong><br />KES ${formatAmount(totals.totalAmount)}</div>
        <div class="card"><strong>Ready rows</strong><br />${totals.validCount}</div>
        <div class="card"><strong>Rows with issues</strong><br />${totals.invalidCount}</div>
      </div>
      <p><strong>Skipped rows:</strong> ${totals.skippedCount} (zero or negative payroll balances are excluded from the Openfloat file)</p>
      <table>
        <thead>
          <tr>
            <th>Employee</th>
            <th>Type</th>
            <th>Account name</th>
            <th>Account no.</th>
            <th>Till / Paybill no.</th>
            <th>Business name</th>
            <th>Notification phone</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </body>
  </html>`;
}

function formatAmount(value: number) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
