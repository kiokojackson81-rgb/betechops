import { z } from "zod";

export const QUOTE_PAYMENT_METHODS = [
  "MPESA_PAYBILL",
  "EQUITY_BANK",
  "ABSA_BANK",
] as const;

export type QuotePaymentMethod = (typeof QUOTE_PAYMENT_METHODS)[number];

export const QUOTE_PAYMENT_TERMS = [
  "FULL_PAYMENT",
  "DEPOSIT_AND_BALANCE",
] as const;

export type QuotePaymentTerms = (typeof QUOTE_PAYMENT_TERMS)[number];

function parseMoneyInput(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
}

export const quoteLineItemSchema = z.object({
  itemName: z.string().trim().min(1).max(600),
  quantity: z.preprocess(parseMoneyInput, z.number().positive().max(100000)),
  unitPrice: z.preprocess(parseMoneyInput, z.number().nonnegative().max(1000000000)),
});

export type QuoteLineItemInput = z.infer<typeof quoteLineItemSchema>;

export type StoredQuoteLineItem = QuoteLineItemInput & {
  lineTotal: number;
};

export const quotePaymentMethodSchema = z.enum(QUOTE_PAYMENT_METHODS);
export const quotePaymentTermsSchema = z.enum(QUOTE_PAYMENT_TERMS);

export const PAYMENT_METHOD_DETAILS: Record<
  QuotePaymentMethod,
  {
    label: string;
    lines: string[];
  }
> = {
  MPESA_PAYBILL: {
    label: "M-Pesa Paybill",
    lines: ["Paybill Number: 516600", "Account Number: 0710098001"],
  },
  EQUITY_BANK: {
    label: "Equity Bank Transfer / Deposit",
    lines: [
      "Bank Name: Equity Bank",
      "Account Name: Betech Technologies Limited",
      "Branch: Moi Avenue",
      "Account Number: 0470265072030",
    ],
  },
  ABSA_BANK: {
    label: "Absa Bank Transfer / Deposit",
    lines: [
      "Bank Name: Absa Bank Kenya",
      "Account Name: Betech Solar Solution",
      "Account Number: 2047639940",
    ],
  },
};

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sanitizeQuoteLineItems(items: QuoteLineItemInput[]): StoredQuoteLineItem[] {
  return items
    .map((item) => ({
      itemName: item.itemName.trim(),
      quantity: roundCurrency(Number(item.quantity || 0)),
      unitPrice: roundCurrency(Number(item.unitPrice || 0)),
    }))
    .filter((item) => item.itemName && item.quantity > 0)
    .map((item) => ({
      ...item,
      lineTotal: roundCurrency(item.quantity * item.unitPrice),
    }));
}

export function calculateQuoteTotal(items: StoredQuoteLineItem[]) {
  return roundCurrency(items.reduce((sum, item) => sum + item.lineTotal, 0));
}

export function normalizeQuotePaymentBreakdown(input: {
  total: number;
  paymentTerms?: QuotePaymentTerms | null;
  depositAmount?: number | null | undefined;
  balanceAmount?: number | null | undefined;
}) {
  const total = roundCurrency(input.total);
  if (input.paymentTerms !== "DEPOSIT_AND_BALANCE") {
    return {
      paymentTerms: (input.paymentTerms || "FULL_PAYMENT") as QuotePaymentTerms,
      depositAmount: null,
      balanceAmount: null,
      total,
    };
  }

  const depositAmount =
    typeof input.depositAmount === "number" && Number.isFinite(input.depositAmount)
      ? roundCurrency(Math.max(0, input.depositAmount))
      : null;
  const fallbackBalance =
    depositAmount !== null ? roundCurrency(Math.max(0, total - depositAmount)) : null;
  const balanceAmount =
    typeof input.balanceAmount === "number" && Number.isFinite(input.balanceAmount)
      ? roundCurrency(Math.max(0, input.balanceAmount))
      : fallbackBalance;

  return {
    paymentTerms: "DEPOSIT_AND_BALANCE" as QuotePaymentTerms,
    depositAmount,
    balanceAmount,
    total,
  };
}

export function formatQuoteCurrency(value: number | null | undefined) {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function parseStoredQuoteProposal(
  quotationData: Record<string, unknown> | null | undefined,
) {
  const items = Array.isArray(quotationData?.items)
    ? sanitizeQuoteLineItems(
        quotationData.items
          .map((item) =>
            item && typeof item === "object"
              ? {
                  itemName: String((item as Record<string, unknown>).itemName ?? ""),
                  quantity: Number((item as Record<string, unknown>).quantity ?? 0),
                  unitPrice: Number((item as Record<string, unknown>).unitPrice ?? 0),
                }
              : null,
          )
          .filter((item): item is QuoteLineItemInput => Boolean(item)),
      )
    : [];

  const subtotal =
    typeof quotationData?.subtotal === "number" && Number.isFinite(quotationData.subtotal)
      ? roundCurrency(quotationData.subtotal)
      : calculateQuoteTotal(items);
  const total =
    typeof quotationData?.total === "number" && Number.isFinite(quotationData.total)
      ? roundCurrency(quotationData.total)
      : subtotal;
  const paymentMethod = QUOTE_PAYMENT_METHODS.includes(
    String(quotationData?.paymentMethod || "") as QuotePaymentMethod,
  )
    ? (String(quotationData?.paymentMethod) as QuotePaymentMethod)
    : null;
  const paymentTerms = QUOTE_PAYMENT_TERMS.includes(
    String(quotationData?.paymentTerms || "") as QuotePaymentTerms,
  )
    ? (String(quotationData?.paymentTerms) as QuotePaymentTerms)
    : null;

  const depositAmount =
    typeof quotationData?.depositAmount === "number" && Number.isFinite(quotationData.depositAmount)
      ? roundCurrency(quotationData.depositAmount)
      : null;
  const balanceAmount =
    typeof quotationData?.balanceAmount === "number" && Number.isFinite(quotationData.balanceAmount)
      ? roundCurrency(quotationData.balanceAmount)
      : null;

  return {
    items,
    subtotal,
    total,
    paymentMethod,
    paymentTerms,
    depositAmount,
    balanceAmount,
  };
}

export function getQuotePaymentMethodLabel(value: QuotePaymentMethod | null | undefined) {
  if (!value) return "Not selected";
  return PAYMENT_METHOD_DETAILS[value]?.label || value;
}

export function getQuotePaymentTermsLabel(value: QuotePaymentTerms | null | undefined) {
  if (value === "DEPOSIT_AND_BALANCE") return "Deposit and balance";
  if (value === "FULL_PAYMENT") return "Full payment";
  return "Not specified";
}
