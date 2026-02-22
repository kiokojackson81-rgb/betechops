export type ParsedProfitTransaction = {
  date: Date;
  itemCreditTxn: string;
  itemCreditAmount: number;
  commissionTxn: string | null;
  commissionAmount: number;
  shippingTxn: string | null;
  shippingAmount: number;
};

const DAYS =
  "(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)";
const MONTHS =
  "(January|February|March|April|May|June|July|August|September|October|November|December)";

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const val = Number(cleaned);
  if (!Number.isFinite(val)) return null;
  return val;
}

function extractTxnAndAmount(block: string, label: string): { txn: string | null; amount: number | null } {
  const lines = block.split(/\r?\n/).map((l) => l.trim());
  const hit = lines.find((line) => line.toLowerCase().includes(label.toLowerCase()));
  if (!hit) return { txn: null, amount: null };

  const txnMatch = hit.match(/Number:\s*([A-Za-z0-9-]+)/i);
  const txn = txnMatch?.[1] ?? null;

  // Prefer explicit "KES 123" patterns, otherwise take last number-like token.
  const kesMatch = hit.match(/(?:KES|Ksh|KSh)\s*([-]?[0-9,]+(?:\.[0-9]+)?)/i);
  if (kesMatch?.[1]) {
    return { txn, amount: parseMoney(kesMatch[1]) };
  }

  const numbers = hit.match(/[-]?[0-9,]+(?:\.[0-9]+)?/g);
  const last = numbers?.at(-1) ?? null;
  return { txn, amount: last ? parseMoney(last) : null };
}

function extractDate(block: string): Date | null {
  const match = block.match(new RegExp(`${DAYS},\\s+${MONTHS}\\s+\\d{1,2},\\s+\\d{4}`, "i"));
  const raw = match?.[0]?.trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  // Fallback: look for ISO-like date only.
  const iso = block.match(/\\b\\d{4}-\\d{2}-\\d{2}\\b/);
  if (iso?.[0]) {
    const parsed = new Date(iso[0]);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

export function parseMarketplaceProfitTransaction(rawText: string): ParsedProfitTransaction {
  const date = extractDate(rawText);
  if (!date) {
    throw new Error("Could not extract a date from the pasted text. Please paste the full transaction block.");
  }

  const credit = extractTxnAndAmount(rawText, "Item Price Credit");
  if (!credit.txn || credit.amount == null) {
    throw new Error("Could not extract Item Price Credit (txn + amount). Please paste the full transaction block.");
  }

  const commission = extractTxnAndAmount(rawText, "Commission");
  const shipping = extractTxnAndAmount(rawText, "Shipping Fee");

  const itemCreditAmount = Math.abs(Number(credit.amount));
  const commissionAmount = commission.amount == null ? 0 : -Math.abs(Number(commission.amount));
  const shippingAmount = shipping.amount == null ? 0 : -Math.abs(Number(shipping.amount));

  return {
    date,
    itemCreditTxn: credit.txn,
    itemCreditAmount,
    commissionTxn: commission.txn,
    commissionAmount,
    shippingTxn: shipping.txn,
    shippingAmount,
  };
}

