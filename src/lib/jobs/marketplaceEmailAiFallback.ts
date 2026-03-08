import "server-only";

import OpenAI from "openai";
import { MarketplaceEmailParserType } from "@prisma/client";

export type MarketplaceAiExtractInput = {
  subject: string | null;
  fromEmail: string | null;
  bodyText: string;
  parserHint: MarketplaceEmailParserType | null;
};

export type AiJumiaReturnPickup = {
  type: "JUMIA_RETURN_PICKUP";
  shopLabel: string | null;
  stationName: string | null;
  totalItems: number | null;
  totalPackages: number | null;
  rows: Array<{
    trackingNumber: string;
    orderNumber: string;
    itemDescription: string | null;
    remainingDays: number | null;
  }>;
};

export type AiJumiaDailyReport = {
  type: "JUMIA_DAILY_REPORT";
  shopLabel: string | null;
  reportDate: string;
  newOrders: number;
  pendingToday: number;
  readyToShip: number;
  returnedToday: number;
  cancelledToday: number;
  deliveredToday: number;
  deliveryFailed: number;
};

export type AiKilimallNewOrder = {
  type: "KILIMALL_NEW_ORDER";
  shopLabel: string | null;
  orderNumber: string;
  itemTitle: string | null;
};

export type AiUnknownMarketplace = {
  type: "UNKNOWN_MARKETPLACE_EMAIL";
  shopLabel: string | null;
  reason: string | null;
};

export type MarketplaceAiExtractResult = AiJumiaReturnPickup | AiJumiaDailyReport | AiKilimallNewOrder | AiUnknownMarketplace;

const MODEL = process.env.MARKETPLACE_EMAIL_AI_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function asInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number.parseInt(v.trim(), 10);
  return null;
}

function normalizeType(v: unknown): MarketplaceAiExtractResult["type"] | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toUpperCase();
  if (t === "JUMIA_RETURN_PICKUP" || t === "JUMIA_DAILY_REPORT" || t === "KILIMALL_NEW_ORDER" || t === "UNKNOWN_MARKETPLACE_EMAIL") {
    return t;
  }
  return null;
}

function validateAiResult(raw: unknown): { ok: true; data: MarketplaceAiExtractResult } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "AI_JSON_NOT_OBJECT" };
  const obj = raw as Record<string, unknown>;
  const type = normalizeType(obj.type);
  if (!type) return { ok: false, error: "AI_TYPE_INVALID" };

  if (type === "JUMIA_RETURN_PICKUP") {
    if (!Array.isArray(obj.rows) || obj.rows.length === 0) return { ok: false, error: "AI_PICKUP_ROWS_EMPTY" };
    const rows = obj.rows
      .map((r) => {
        if (!r || typeof r !== "object") return null;
        const rr = r as Record<string, unknown>;
        const trackingNumber = asString(rr.trackingNumber);
        const orderNumber = asString(rr.orderNumber);
        const itemDescription = asString(rr.itemDescription);
        const remainingDays = asInt(rr.remainingDays);
        if (!trackingNumber || !orderNumber) return null;
        if (remainingDays != null && remainingDays < 0) return null;
        return { trackingNumber, orderNumber, itemDescription, remainingDays };
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
    if (!rows.length) return { ok: false, error: "AI_PICKUP_ROWS_INVALID" };
    return {
      ok: true,
      data: {
        type,
        shopLabel: asString(obj.shopLabel),
        stationName: asString(obj.stationName),
        totalItems: asInt(obj.totalItems),
        totalPackages: asInt(obj.totalPackages),
        rows,
      },
    };
  }

  if (type === "JUMIA_DAILY_REPORT") {
    const reportDate = asString(obj.reportDate);
    if (!reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return { ok: false, error: "AI_DAILY_DATE_INVALID" };
    const ints = {
      newOrders: asInt(obj.newOrders),
      pendingToday: asInt(obj.pendingToday),
      readyToShip: asInt(obj.readyToShip),
      returnedToday: asInt(obj.returnedToday),
      cancelledToday: asInt(obj.cancelledToday),
      deliveredToday: asInt(obj.deliveredToday),
      deliveryFailed: asInt(obj.deliveryFailed),
    };
    if (Object.values(ints).some((v) => v == null || v < 0)) return { ok: false, error: "AI_DAILY_INTS_INVALID" };
    return { ok: true, data: { type, shopLabel: asString(obj.shopLabel), reportDate, ...ints } as AiJumiaDailyReport };
  }

  if (type === "KILIMALL_NEW_ORDER") {
    const orderNumber = asString(obj.orderNumber);
    if (!orderNumber) return { ok: false, error: "AI_KILIMALL_ORDER_MISSING" };
    return {
      ok: true,
      data: {
        type,
        shopLabel: asString(obj.shopLabel),
        orderNumber,
        itemTitle: asString(obj.itemTitle),
      },
    };
  }

  return {
    ok: true,
    data: {
      type,
      shopLabel: asString(obj.shopLabel),
      reason: asString(obj.reason),
    },
  };
}

export async function extractMarketplaceEmailWithAI(input: MarketplaceAiExtractInput): Promise<{
  ok: boolean;
  data?: MarketplaceAiExtractResult;
  error?: string;
  raw?: unknown;
}> {
  if (!process.env.OPENAI_API_KEY) return { ok: false, error: "OPENAI_API_KEY_MISSING" };

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You extract marketplace email data. Return STRICT JSON only. No markdown. Prefer null over guessing. Supported types: JUMIA_RETURN_PICKUP, JUMIA_DAILY_REPORT, KILIMALL_NEW_ORDER, UNKNOWN_MARKETPLACE_EMAIL.",
      },
      {
        role: "user",
        content: JSON.stringify({
          parserHint: input.parserHint,
          fromEmail: input.fromEmail,
          subject: input.subject,
          bodyText: input.bodyText.slice(0, 22000),
          requiredValidation: {
            pickupRowsMustBeNonEmpty: true,
            trackingAndOrderRequired: true,
            remainingDaysNonNegative: true,
            dailyDateFormat: "YYYY-MM-DD",
          },
        }),
      },
    ],
  });

  const content = completion.choices?.[0]?.message?.content ?? "";
  if (!content) return { ok: false, error: "AI_EMPTY_RESPONSE" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, error: "AI_JSON_PARSE_FAILED", raw: content };
  }

  const validated = validateAiResult(parsed);
  if (!validated.ok) return { ok: false, error: validated.error, raw: parsed };
  return { ok: true, data: validated.data, raw: parsed };
}

