import OpenAI from "openai";
import { z } from "zod";
import { parseMarketplaceProfitTransaction } from "@/lib/marketplaceProfitParser";

export type ProfitExtraction = {
  method: "regex" | "openai";
  date: Date;
  currency: "KES";
  itemPriceCredit: { amount: number; txn: string };
  commission: { amount: number; txn: string };
  shippingFee: { amount: number; txn: string };
  confidence: number;
  notes: string[];
};

const ExtractionSchema = z.object({
  date: z.string().min(4),
  currency: z.literal("KES"),
  item_price_credit: z.object({
    amount: z.number(),
    txn: z.string().min(1),
  }),
  commission: z.object({
    amount: z.number(),
    txn: z.string().min(1),
  }),
  shipping_fee: z.object({
    amount: z.number(),
    txn: z.string().min(1),
  }),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.array(z.string()).optional(),
});

function normalizePositive(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.abs(amount);
}

function normalizeNegative(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return -Math.abs(amount);
}

function parseDateISO(value: string): Date | null {
  const trimmed = value.trim();
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

export function tryRegexExtraction(transactionText: string): ProfitExtraction | null {
  try {
    const parsed = parseMarketplaceProfitTransaction(transactionText);
    if (!parsed.itemCreditTxn || !Number.isFinite(parsed.itemCreditAmount)) return null;
    if (!parsed.commissionTxn || !Number.isFinite(parsed.commissionAmount)) return null;
    if (!parsed.shippingTxn || !Number.isFinite(parsed.shippingAmount)) return null;

    return {
      method: "regex",
      date: parsed.date,
      currency: "KES",
      itemPriceCredit: {
        amount: normalizePositive(parsed.itemCreditAmount),
        txn: parsed.itemCreditTxn,
      },
      commission: {
        amount: normalizeNegative(parsed.commissionAmount),
        txn: parsed.commissionTxn,
      },
      shippingFee: {
        amount: normalizeNegative(parsed.shippingAmount),
        txn: parsed.shippingTxn,
      },
      confidence: 1,
      notes: ["Parsed using deterministic regex rules."],
    };
  } catch {
    return null;
  }
}

export async function extractProfitTransactionWithOpenAI(transactionText: string): Promise<ProfitExtraction> {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You extract transaction fields from marketplace transaction blocks. Return JSON only.",
      },
      {
        role: "user",
        content: [
          "Extract from this text:",
          "",
          "date",
          "Shipping Fee {amount, txn}",
          "Commission {amount, txn}",
          "Item Price Credit {amount, txn}",
          "Currency KES.",
          "Commission and shipping must be negative numbers.",
          "Return STRICT JSON only with keys: date,currency,shipping_fee,commission,item_price_credit,confidence,notes.",
          "",
          "Text:",
          transactionText,
        ].join("\n"),
      },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content ?? "";
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  const data = ExtractionSchema.parse(json);
  const date = parseDateISO(data.date);
  if (!date) throw new Error("OpenAI could not extract a valid date");

  const confidence = typeof data.confidence === "number" ? data.confidence : 0.5;
  const notes = Array.isArray(data.notes) ? data.notes : [];

  return {
    method: "openai",
    date,
    currency: "KES",
    itemPriceCredit: { amount: normalizePositive(data.item_price_credit.amount), txn: data.item_price_credit.txn },
    commission: { amount: normalizeNegative(data.commission.amount), txn: data.commission.txn },
    shippingFee: { amount: normalizeNegative(data.shipping_fee.amount), txn: data.shipping_fee.txn },
    confidence,
    notes,
  };
}

export async function extractProfitTransaction(transactionText: string): Promise<ProfitExtraction> {
  const fast = tryRegexExtraction(transactionText);
  if (fast) return fast;
  return extractProfitTransactionWithOpenAI(transactionText);
}

