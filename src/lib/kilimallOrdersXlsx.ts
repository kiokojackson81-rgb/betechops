import * as XLSX from "xlsx";
import { mondayToSundayNairobiWindow } from "@/lib/weekWindow";

export type KilimallXlsxOrder = {
  orderNo: string;
  orderDate: Date;
  trackingNo: string | null;
  productId: string | null;
  productName: string | null;
  qty: number | null;
  productAmount: number;
  shippingFee: number;
  totalDeduction: number;
  payableAmount: number;
  commissionAmount?: number | null;
  settlementAmount?: number | null;
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "");
}

function parseMoney(value: unknown): number {
  const raw = String(value ?? "")
    .replace(/KSh/gi, "")
    .replace(/,/g, "")
    .trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function parseDateCell(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    // Excel serial date.
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    const dt = new Date(Date.UTC(d.y, d.m - 1, d.d, d.H, d.M, d.S));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  // Try "YYYY-MM-DD HH:mm:ss"
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (m) {
    const iso = `${m[1]}T${m[2]}+03:00`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseKilimallOrdersXlsx(buffer: Buffer): { orders: KilimallXlsxOrder[]; headers: string[] } {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName =
    workbook.SheetNames.find((n) => normalizeHeader(n) === "bill details") ?? workbook.SheetNames[0] ?? "";
  if (!sheetName) return { orders: [], headers: [] };
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { orders: [], headers: [] };

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "", raw: true });
  const headers = rows.length ? Object.keys(rows[0] ?? {}) : [];
  const headerMap = new Map<string, string>();
  for (const h of headers) headerMap.set(normalizeHeader(h), h);

  const get = (row: Record<string, any>, headerAliases: string[]) => {
    for (const alias of headerAliases) {
      const key = headerMap.get(alias);
      if (key && key in row) return row[key];
    }
    return "";
  };

  const orders: KilimallXlsxOrder[] = [];
  for (const row of rows) {
    const orderNoRaw = String(get(row, ["order sn", "order no", "order number", "orderno", "order"])).trim();
    const orderNo = orderNoRaw.replace(/^,+/, "").trim();
    if (!orderNo) continue;

    // Kilimall "order-sku-list" exports often use Order Time / Complete Time rather than Order Date.
    const orderDateCell = get(row, ["finnshed time", "finished time", "complete time", "order date", "order time", "payment time", "date"]);
    const orderDate = parseDateCell(orderDateCell);
    if (!orderDate) continue;

    const productId = String(get(row, ["goods id", "product id", "productid", "sku id", "sku", "item id"])).trim() || null;
    const productName = String(get(row, ["goods name", "product name", "item name", "sku title", "name", "product"])).trim() || null;
    const trackingNo = String(get(row, ["tracking no", "tracking number", "trackingno", "shipment no"])).trim() || null;

    const qtyRaw = Number(String(get(row, ["goods num", "sold qty", "qty", "quantity"])).trim());
    const qty = Number.isFinite(qtyRaw) ? qtyRaw : null;

    // Some exports include "Deal Price" and "Discount" but not payable totals.
    const dealPrice = parseMoney(get(row, ["deal price", "price", "unit price"]));
    const discount = parseMoney(get(row, ["discount"]));

    const completeAmount = parseMoney(get(row, ["complete amount"]));
    const productAmount =
      parseMoney(get(row, ["product amount", "productamount", "amount"])) ||
      (completeAmount ? completeAmount : dealPrice && qty ? dealPrice * qty : dealPrice);
    const shippingFee = parseMoney(get(row, ["shipping fee", "shippingfee", "shipping"])) || 0;
    const totalDeduction = parseMoney(get(row, ["total deduction", "totaldeduction", "deduction"])) || 0;
    const payableAmountRaw = parseMoney(get(row, ["payable amount", "payableamount", "payout", "payable"]));
    const settlement = parseMoney(get(row, ["settlement", "settlement payable"]));
    const commission = parseMoney(get(row, ["commission"]));
    const payableAmount =
      payableAmountRaw || settlement || Math.max(0, (dealPrice && qty ? dealPrice * qty : dealPrice) - discount) || Math.max(0, productAmount + shippingFee - totalDeduction);

    orders.push({
      orderNo,
      orderDate,
      trackingNo,
      productId,
      productName,
      qty,
      productAmount,
      shippingFee,
      totalDeduction,
      payableAmount,
      commissionAmount: commission == null ? null : Number(commission),
      settlementAmount: settlement == null ? null : Number(settlement),
    });
  }

  return { orders, headers };
}

export function filterOrdersToCurrentWeek(orders: KilimallXlsxOrder[], now: Date) {
  const { weekStart, weekEnd } = mondayToSundayNairobiWindow(now);
  const inWeek = orders.filter((o) => o.orderDate >= weekStart && o.orderDate <= weekEnd);
  const excluded = orders.length - inWeek.length;
  return { weekStart, weekEnd, inWeek, excluded };
}

// "Last 4 full weeks" behavior: on a Wednesday, we want the previous Mon–Sun window (already completed),
// not the in-progress week.
export function filterOrdersToLastFullWeek(orders: KilimallXlsxOrder[], now: Date) {
  const base = new Date(now);
  base.setDate(base.getDate() - 7);
  const { weekStart, weekEnd } = mondayToSundayNairobiWindow(base);
  const inWeek = orders.filter((o) => o.orderDate >= weekStart && o.orderDate <= weekEnd);
  const excluded = orders.length - inWeek.length;
  return { weekStart, weekEnd, inWeek, excluded };
}
