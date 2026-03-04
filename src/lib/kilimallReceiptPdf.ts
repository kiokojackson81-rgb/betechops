import { PDFParse } from "pdf-parse";
import { mondayToSundayNairobiWindow } from "@/lib/weekWindow";

export type KilimallPdfOrder = {
  orderNo: string;
  orderDate: Date;
  trackingNo: string | null;
  productId: string | null;
  productName: string | null;
  specification: string | null;
  shopName: string | null;
  qty: number | null;
  productAmount: number;
  shippingFee: number;
  totalDeduction: number;
  payableAmount: number;
};

function parseMoney(value: string | null | undefined): number {
  const raw = String(value ?? "")
    .replace(/KSh/gi, "")
    .replace(/,/g, "")
    .trim();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function parseOrderDateNairobi(value: string | null | undefined): Date | null {
  const raw = String(value ?? "").trim();
  // Example: "2026-03-03 13:33:16" (assumed Nairobi time)
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}+03:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function parseKilimallReceiptPdf(buffer: Buffer): Promise<{
  orders: KilimallPdfOrder[];
  text: string;
}> {
  const parser = new PDFParse(buffer);
  const text = normalizeWhitespace((await (parser as any).getText()) || "");

  // Split by "Order No.:" blocks (each receipt page typically includes this marker).
  const parts = text.split(/(?=Order No\.\s*:\s*\d{6,})/g);
  const orders: KilimallPdfOrder[] = [];

  for (const part of parts) {
    const orderNo = part.match(/Order No\.\s*:\s*(\d{6,})/i)?.[1] ?? null;
    if (!orderNo) continue;

    const orderDateRaw = part.match(/Order Date\s*:\s*([0-9-]{10}\s+[0-9:]{8})/i)?.[1] ?? null;
    const orderDate = parseOrderDateNairobi(orderDateRaw);
    if (!orderDate) continue;

    const trackingNo = part.match(/Tracking No\.\s*:\s*([A-Z0-9]+)/i)?.[1] ?? null;

    const productAmount = parseMoney(part.match(/Product amount\s*:\s*KSh\s*([0-9,]+(?:\.\d+)?)/i)?.[1]);
    const shippingFee = parseMoney(part.match(/Shipping fee\s*:\s*KSh\s*([0-9,]+(?:\.\d+)?)/i)?.[1]);
    const totalDeduction = parseMoney(part.match(/Total deduction\s*:\s*KSh\s*([0-9,]+(?:\.\d+)?)/i)?.[1]);
    const payableAmount = parseMoney(part.match(/Payable amount\s*:\s*KSh\s*([0-9,]+(?:\.\d+)?)/i)?.[1]);

    // Table extraction (best-effort): find the first product row that includes a product id and amount.
    let productId: string | null = null;
    let productName: string | null = null;
    let specification: string | null = null;
    let shopName: string | null = null;
    let qty: number | null = null;

    const tableMatch = part.match(
      /Products Details[\s\S]*?\n\d+\s*\n(\d{6,})\s*\n([^\n]+)\s*\n([^\n]+)\s*\n([^\n]+)\s*\n(\d+)\s*\n([0-9,]+)\b/i,
    );
    if (tableMatch) {
      productId = String(tableMatch[1] ?? "").trim() || null;
      productName = String(tableMatch[2] ?? "").trim() || null;
      specification = String(tableMatch[3] ?? "").trim() || null;
      shopName = String(tableMatch[4] ?? "").trim() || null;
      const q = Number(String(tableMatch[5] ?? "").trim());
      qty = Number.isFinite(q) ? q : null;
    }

    orders.push({
      orderNo,
      orderDate,
      trackingNo,
      productId,
      productName,
      specification,
      shopName,
      qty,
      productAmount,
      shippingFee,
      totalDeduction,
      payableAmount,
    });
  }

  return { orders, text };
}

export function filterOrdersToCurrentWeek(orders: KilimallPdfOrder[], now: Date) {
  const { weekStart, weekEnd } = mondayToSundayNairobiWindow(now);
  const inWeek = orders.filter((o) => o.orderDate >= weekStart && o.orderDate <= weekEnd);
  const excluded = orders.length - inWeek.length;
  return { weekStart, weekEnd, inWeek, excluded };
}
