import Papa from "papaparse";
import { parseDateOnlyUtc } from "@/lib/weekWindow";

export type MarketplaceStatementCsvRow = {
  transactionDateRaw: string;
  transactionDateUtc: Date | null;
  transactionType: string;
  transactionNumber: string;
  transactionState: string;
  details: string;
  sellerSku: string;
  jumiaSku: string;
  amount: number;
  statementStart: Date | null;
  statementEnd: Date | null;
  paidStatus: string;
  orderNo: string;
  orderItemNo: string;
  orderItemStatus: string;
  shippingProvider: string;
  trackingNumber: string;
  countryCode: string;
  statementNumber: string;
};

export type MarketplaceStatementAggregate = {
  key: string;
  orderNo: string;
  orderItemNo: string;
  details: string;
  sellerSku: string;
  jumiaSku: string;
  orderItemStatus: string;
  shippingProvider: string;
  trackingNumber: string;
  countryCode: string;
  statementNumber: string;
  paidStatus: string;
  dateUtc: Date;
  itemCreditTxn: string;
  commissionTxn: string | null;
  shippingTxn: string | null;
  otherTxn: string[];
  grossSale: number;
  commission: number;
  shippingFee: number;
  otherFees: number;
  netPayout: number;
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_-]+/g, " ");
}

function parseMoney(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.replace(/,/g, "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function parseNairobiTimestampToUtc(raw: string): Date | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  // Support formats like:
  // - 2026-02-23 08:15:00
  // - 2026-02-23T08:15:00
  // - 2026-02-23
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = match[4] ? Number(match[4]) : 0;
  const minute = match[5] ? Number(match[5]) : 0;
  const second = match[6] ? Number(match[6]) : 0;

  if ([year, month, day, hour, minute, second].some((n) => Number.isNaN(n))) return null;
  // Nairobi is UTC+3 (no DST). Convert Nairobi-local timestamp to UTC.
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, second, 0));
}

export function parseMarketplaceStatementCsv(csvText: string): { rows: MarketplaceStatementCsvRow[]; errors: string[] } {
  const errors: string[] = [];
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (result.errors?.length) {
    for (const err of result.errors.slice(0, 10)) {
      errors.push(err.message);
    }
  }

  const data = Array.isArray(result.data) ? result.data : [];

  const rows: MarketplaceStatementCsvRow[] = data
    .map((record) => {
      const map = new Map<string, string>();
      for (const [k, v] of Object.entries(record ?? {})) {
        map.set(normalizeHeader(k), String(v ?? ""));
      }

      const transactionDateRaw = map.get("transaction date") ?? "";
      const statementStartRaw = map.get("statement start date") ?? "";
      const statementEndRaw = map.get("statement end date") ?? "";

      const statementStart = parseDateOnlyUtc(statementStartRaw) ?? parseNairobiTimestampToUtc(statementStartRaw);
      const statementEnd = parseDateOnlyUtc(statementEndRaw) ?? parseNairobiTimestampToUtc(statementEndRaw);

      return {
        transactionDateRaw,
        transactionDateUtc: parseNairobiTimestampToUtc(transactionDateRaw),
        transactionType: (map.get("transaction type") ?? "").trim(),
        transactionNumber: (map.get("transaction number") ?? "").trim(),
        transactionState: (map.get("transaction state") ?? "").trim(),
        details: (map.get("details") ?? "").trim(),
        sellerSku: (map.get("seller sku") ?? "").trim(),
        jumiaSku: (map.get("jumia sku") ?? "").trim(),
        amount: parseMoney(map.get("amount")),
        statementStart,
        statementEnd,
        paidStatus: (map.get("paid status") ?? "").trim(),
        orderNo: (map.get("order no.") ?? map.get("order no") ?? "").trim(),
        orderItemNo: (map.get("order item no.") ?? map.get("order item no") ?? "").trim(),
        orderItemStatus: (map.get("order item status") ?? "").trim(),
        shippingProvider: (map.get("shipping provider") ?? "").trim(),
        trackingNumber: (map.get("tracking number") ?? "").trim(),
        countryCode: (map.get("country code") ?? "").trim(),
        statementNumber: (map.get("statement number") ?? "").trim(),
      } satisfies MarketplaceStatementCsvRow;
    })
    .filter((row) => {
      if (!row.transactionType && !row.transactionNumber && !row.orderNo && !row.orderItemNo) return false;
      return true;
    });

  const missingDates = rows.filter((r) => !r.transactionDateUtc).length;
  if (missingDates) {
    errors.push(`Could not parse Transaction Date for ${missingDates} row(s).`);
  }

  return { rows, errors };
}

type AggregateBucket = {
  base: Omit<
    MarketplaceStatementAggregate,
    | "key"
    | "dateUtc"
    | "itemCreditTxn"
    | "commissionTxn"
    | "shippingTxn"
    | "otherTxn"
    | "grossSale"
    | "commission"
    | "shippingFee"
    | "otherFees"
    | "netPayout"
  >;
  dateUtc: Date | null;
  itemCreditTxn: string;
  commissionTxn: string | null;
  shippingTxn: string | null;
  otherTxn: string[];
  grossSale: number;
  commission: number;
  shippingFee: number;
  otherFees: number;
};

function classifyType(txnType: string) {
  const t = txnType.trim().toLowerCase();
  if (!t) return "other";
  if (t.includes("item price credit")) return "item_credit";
  if (t === "commission" || t.includes("commission")) return "commission";
  if (t.includes("shipping fee")) return "shipping";
  return "other";
}

export function aggregateMarketplaceStatementRows(opts: {
  rows: MarketplaceStatementCsvRow[];
  weekStartUtc?: Date;
  weekEndUtc?: Date;
}): { aggregates: MarketplaceStatementAggregate[]; skipped: number; errors: string[] } {
  const errors: string[] = [];
  const byKey = new Map<string, AggregateBucket>();
  let skipped = 0;

  for (const row of opts.rows) {
    const dateUtc = row.transactionDateUtc;
    if (!dateUtc) {
      skipped += 1;
      continue;
    }
    if (opts.weekStartUtc && opts.weekEndUtc) {
      if (!(dateUtc >= opts.weekStartUtc && dateUtc < opts.weekEndUtc)) {
        continue;
      }
    }

    const key = row.orderItemNo || row.orderNo || row.transactionNumber || `${row.details}__${row.jumiaSku}__${row.sellerSku}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        base: {
          orderNo: row.orderNo,
          orderItemNo: row.orderItemNo,
          details: row.details,
          sellerSku: row.sellerSku,
          jumiaSku: row.jumiaSku,
          orderItemStatus: row.orderItemStatus,
          shippingProvider: row.shippingProvider,
          trackingNumber: row.trackingNumber,
          countryCode: row.countryCode,
          statementNumber: row.statementNumber,
          paidStatus: row.paidStatus,
        },
        dateUtc,
        itemCreditTxn: "",
        commissionTxn: null,
        shippingTxn: null,
        otherTxn: [],
        grossSale: 0,
        commission: 0,
        shippingFee: 0,
        otherFees: 0,
      });
    }

    const bucket = byKey.get(key)!;

    if (!bucket.dateUtc || dateUtc < bucket.dateUtc) bucket.dateUtc = dateUtc;

    const kind = classifyType(row.transactionType);
    if (kind === "item_credit") {
      bucket.grossSale += row.amount;
      if (!bucket.itemCreditTxn && row.transactionNumber) bucket.itemCreditTxn = row.transactionNumber;
      continue;
    }
    if (kind === "commission") {
      bucket.commission += row.amount;
      if (!bucket.commissionTxn && row.transactionNumber) bucket.commissionTxn = row.transactionNumber;
      continue;
    }
    if (kind === "shipping") {
      bucket.shippingFee += row.amount;
      if (!bucket.shippingTxn && row.transactionNumber) bucket.shippingTxn = row.transactionNumber;
      continue;
    }

    bucket.otherFees += row.amount;
    if (row.transactionNumber) bucket.otherTxn.push(row.transactionNumber);
  }

  const aggregates: MarketplaceStatementAggregate[] = [];
  for (const [key, bucket] of byKey) {
    const dateUtc = bucket.dateUtc;
    if (!dateUtc) continue;
    const netPayout = bucket.grossSale + bucket.commission + bucket.shippingFee + bucket.otherFees;
    if (!bucket.itemCreditTxn) {
      // Fallback to a stable synthetic id to allow saves without item credit txn.
      const fallback = bucket.base.orderItemNo || bucket.base.orderNo || `csv-${key}`;
      bucket.itemCreditTxn = `CSV:${fallback}`;
    }
    aggregates.push({
      key,
      ...bucket.base,
      dateUtc,
      itemCreditTxn: bucket.itemCreditTxn,
      commissionTxn: bucket.commissionTxn,
      shippingTxn: bucket.shippingTxn,
      otherTxn: bucket.otherTxn.slice(0, 10),
      grossSale: round2(bucket.grossSale),
      commission: round2(bucket.commission),
      shippingFee: round2(bucket.shippingFee),
      otherFees: round2(bucket.otherFees),
      netPayout: round2(netPayout),
    });
  }

  if (!aggregates.length) {
    errors.push("No rows were detected for the selected week.");
  }

  aggregates.sort((a, b) => a.dateUtc.getTime() - b.dateUtc.getTime());

  return { aggregates, skipped, errors };
}

function round2(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
