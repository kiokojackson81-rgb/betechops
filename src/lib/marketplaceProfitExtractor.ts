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

export const ExtractionSchema = z.object({
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

const CoercibleExtractionSchema = z.object({
  date: z.string().optional(),
  currency: z.string().optional(),
  item_price_credit: z.union([
    ExtractionSchema.shape.item_price_credit,
    z.number(),
    z.string(),
    z.null(),
    z.undefined(),
  ]),
  commission: z.union([ExtractionSchema.shape.commission, z.number(), z.string(), z.null(), z.undefined()]),
  shipping_fee: z.union([ExtractionSchema.shape.shipping_fee, z.number(), z.string(), z.null(), z.undefined()]),
  confidence: z.union([z.number(), z.string()]).optional(),
  notes: z.union([z.array(z.string()), z.string()]).optional(),
});

const ImageBatchSchema = z.object({
  extracted_text: z.string().optional(),
  transactions: z.array(ExtractionSchema).min(1),
  notes: z.array(z.string()).optional(),
});

const CoercibleImageBatchSchema = z.object({
  extracted_text: z.string().optional(),
  transactions: z.array(CoercibleExtractionSchema).min(1),
  notes: z.union([z.array(z.string()), z.string()]).optional(),
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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function parseLooseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").trim();
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function safeRegexParsed(transactionText: string) {
  try {
    return parseMarketplaceProfitTransaction(transactionText);
  } catch {
    return null;
  }
}

function normalizeFromLooseJson(json: unknown, transactionText: string): ProfitExtraction {
  const loose = CoercibleExtractionSchema.parse(json);
  const fallback = safeRegexParsed(transactionText);

  const dateStr = (loose.date ?? "").trim();
  const date = (dateStr && parseDateISO(dateStr)) || fallback?.date || null;
  if (!date) throw new Error("OpenAI could not extract a valid date");

  const itemCredit =
    typeof loose.item_price_credit === "object" && loose.item_price_credit
      ? loose.item_price_credit
      : {
          amount: parseLooseNumber(loose.item_price_credit) ?? fallback?.itemCreditAmount ?? NaN,
          txn: fallback?.itemCreditTxn ?? "",
        };

  const commission =
    typeof loose.commission === "object" && loose.commission
      ? loose.commission
      : {
          amount: parseLooseNumber(loose.commission) ?? fallback?.commissionAmount ?? NaN,
          txn: fallback?.commissionTxn ?? "",
        };

  const shipping =
    typeof loose.shipping_fee === "object" && loose.shipping_fee
      ? loose.shipping_fee
      : {
          amount: parseLooseNumber(loose.shipping_fee) ?? fallback?.shippingAmount ?? NaN,
          txn: fallback?.shippingTxn ?? "",
        };

  const confidenceRaw = parseLooseNumber(loose.confidence);
  const confidence = clamp01(confidenceRaw ?? 0.5);

  const notes = Array.isArray(loose.notes) ? loose.notes : typeof loose.notes === "string" && loose.notes.trim() ? [loose.notes.trim()] : [];

  const currency: "KES" = "KES";

  return {
    method: "openai",
    date,
    currency,
    itemPriceCredit: { amount: normalizePositive(Number(itemCredit.amount)), txn: String(itemCredit.txn ?? "").trim() },
    commission: { amount: normalizeNegative(Number(commission.amount)), txn: String(commission.txn ?? "").trim() },
    shippingFee: { amount: normalizeNegative(Number(shipping.amount)), txn: String(shipping.txn ?? "").trim() },
    confidence,
    notes,
  };
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

function splitByDateMarkers(transactionText: string): string[] {
  const text = transactionText.trim();
  if (!text) return [];

  const dateRe = /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}/g;
  const matches = [...text.matchAll(dateRe)];
  if (matches.length <= 1) return [text];

  const starts = matches.map((m) => m.index ?? 0).filter((v) => v >= 0);
  const blocks: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    const chunk = text.slice(start, end).trim();
    if (chunk) blocks.push(chunk);
  }
  return blocks.length ? blocks : [text];
}

function splitByItemCreditMarkers(transactionText: string): string[] {
  const text = transactionText.trim();
  if (!text) return [];
  const marker = /(?:^|\n)\s*Item Price Credit\b/g;
  const matches = [...text.matchAll(marker)];
  if (matches.length <= 1) return [text];

  const starts = matches.map((m) => (m.index ?? 0) + (m[0].startsWith("\n") ? 1 : 0)).filter((v) => v >= 0);
  const blocks: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    const chunk = text.slice(start, end).trim();
    if (chunk) blocks.push(chunk);
  }
  return blocks.length ? blocks : [text];
}

export function splitProfitTransactionBlocks(transactionText: string): string[] {
  const byDate = splitByDateMarkers(transactionText);
  if (byDate.length > 1) return byDate;
  return splitByItemCreditMarkers(transactionText);
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
          "Example shape (do not include this example in output):",
          JSON.stringify(
            {
              date: "2026-02-15",
              currency: "KES",
              item_price_credit: { amount: 12345, txn: "T260215XXXX" },
              commission: { amount: -234, txn: "T260215YYYY" },
              shipping_fee: { amount: -120, txn: "T260215ZZZZ" },
              confidence: 0.9,
              notes: ["..."],
            },
            null,
            2,
          ),
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

  try {
    const data = ExtractionSchema.parse(json);
    const date = parseDateISO(data.date);
    if (!date) throw new Error("OpenAI could not extract a valid date");

    const confidence = typeof data.confidence === "number" ? clamp01(data.confidence) : 0.5;
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
  } catch {
    // Some model outputs come back with incorrect types; coerce + rehydrate missing txns from regex where possible.
    return normalizeFromLooseJson(json, transactionText);
  }
}

export async function extractProfitTransaction(transactionText: string): Promise<ProfitExtraction> {
  const fast = tryRegexExtraction(transactionText);
  if (fast) return fast;
  return extractProfitTransactionWithOpenAI(transactionText);
}

export async function extractProfitTransactions(transactionText: string, opts?: { max?: number }): Promise<ProfitExtraction[]> {
  const max = opts?.max ?? 25;
  const blocks = splitProfitTransactionBlocks(transactionText).slice(0, max);
  if (blocks.length === 0) return [];

  const results: ProfitExtraction[] = [];
  for (const block of blocks) {
    // eslint-disable-next-line no-await-in-loop
    const extracted = await extractProfitTransaction(block);
    results.push(extracted);
  }
  return results;
}

export async function extractProfitTransactionsFromImage(input: {
  dataUrl: string;
}): Promise<{ extractedText: string; transactions: ProfitExtraction[]; notes: string[] }> {
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
        content: "You extract transaction fields from marketplace transaction screenshots. Return JSON only.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "From this image, extract one or more marketplace transaction blocks and return STRICT JSON only.",
              "",
              "Each transaction must include:",
              "- date (ISO date)",
              "- currency (KES)",
              "- item_price_credit { amount, txn }",
              "- commission { amount, txn }",
              "- shipping_fee { amount, txn }",
              "- confidence (0-1)",
              "- notes (array of strings)",
              "",
              "Rules:",
              "- If commission/shipping appear as positive in the image, return them as NEGATIVE numbers.",
              "- Amounts are numbers in KES.",
              "- Return JSON keys exactly: extracted_text, transactions, notes.",
              "- extracted_text should contain the best-effort plain text transcription of the image.",
            ].join("\n"),
          },
          { type: "image_url", image_url: { url: input.dataUrl } },
        ] as any,
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

  try {
    const data = ImageBatchSchema.parse(json);
    const extractedText = (data.extracted_text ?? "").trim();
    const topNotes = Array.isArray(data.notes) ? data.notes : [];

    const transactions: ProfitExtraction[] = data.transactions.map((t) => {
      const date = parseDateISO(t.date);
      if (!date) throw new Error("OpenAI could not extract a valid date");
      const confidence = typeof t.confidence === "number" ? clamp01(t.confidence) : 0.5;
      const notes = Array.isArray(t.notes) ? t.notes : [];

      return {
        method: "openai",
        date,
        currency: "KES",
        itemPriceCredit: { amount: normalizePositive(t.item_price_credit.amount), txn: t.item_price_credit.txn },
        commission: { amount: normalizeNegative(t.commission.amount), txn: t.commission.txn },
        shippingFee: { amount: normalizeNegative(t.shipping_fee.amount), txn: t.shipping_fee.txn },
        confidence,
        notes,
      };
    });

    return { extractedText, transactions, notes: topNotes };
  } catch {
    const data = CoercibleImageBatchSchema.parse(json);
    const extractedText = (data.extracted_text ?? "").trim();
    const topNotes = Array.isArray(data.notes) ? data.notes : typeof data.notes === "string" && data.notes.trim() ? [data.notes.trim()] : [];
    const transactions = data.transactions.map((t) => normalizeFromLooseJson(t, extractedText || ""));
    return { extractedText, transactions, notes: topNotes };
  }
}
