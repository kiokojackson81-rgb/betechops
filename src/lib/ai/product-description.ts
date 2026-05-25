import { z } from "zod";
import { extractJsonObject, getOpenAiClient, responseText } from "@/lib/ai/openai";
import type { ProductOcrResult } from "@/lib/ai/product-ocr";

function normalizeAiString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function normalizeAiStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => normalizeAiStringArray(entry))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, entry]) => {
        const normalizedEntry = normalizeAiString(entry);
        if (normalizedEntry) return [`${key}: ${normalizedEntry}`];
        if (Array.isArray(entry)) {
          const nested = normalizeAiStringArray(entry);
          return nested.length ? [`${key}: ${nested.join(", ")}`] : [];
        }
        return [key];
      })
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  const normalized = normalizeAiString(value);
  if (!normalized) return [];

  return normalized
    .split(/\r?\n|[;,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const descriptionSchema = z.object({
  productName: z.preprocess(normalizeAiString, z.string().default("")),
  seoTitle: z.preprocess(normalizeAiString, z.string().default("")),
  shortDescription: z.preprocess(normalizeAiString, z.string().default("")),
  ecommerceDescription: z.preprocess(normalizeAiString, z.string().default("")),
  bulletSpecs: z.preprocess(normalizeAiStringArray, z.array(z.string()).default([])),
  keyFeatures: z.preprocess(normalizeAiStringArray, z.array(z.string()).default([])),
  usageExamples: z.preprocess(normalizeAiStringArray, z.array(z.string()).default([])),
  shopCategory: z.preprocess(normalizeAiString, z.string().default("")),
  shopSubcategory: z.preprocess(normalizeAiString, z.string().default("")),
  brand: z.preprocess(normalizeAiString, z.string().default("")),
  tags: z.preprocess(normalizeAiStringArray, z.array(z.string()).default([])),
});

export type ProductDescriptionResult = z.infer<typeof descriptionSchema>;

export async function generateEcommerceProductCopy(input: {
  extracted: ProductOcrResult;
  currentName?: string | null;
  currentBrand?: string | null;
}) {
  const client = getOpenAiClient();
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You write clean ecommerce product drafts for Betech Solar. Use only the visible facts provided. Never invent specs, capacities, or accessories. Keep descriptions concise, professional, and shop-ready. Return only JSON.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `Create a product draft from these extracted facts:\n${JSON.stringify(input.extracted)}\n` +
              `Existing hints:\n${JSON.stringify({
                currentName: input.currentName ?? "",
                currentBrand: input.currentBrand ?? "",
              })}\n` +
              `Return JSON with exact keys: productName, seoTitle, shortDescription, ecommerceDescription, bulletSpecs, keyFeatures, usageExamples, shopCategory, shopSubcategory, brand, tags.\n` +
              `Rules:\n` +
              `- productName must be customer-friendly.\n` +
              `- shortDescription should be 1 short sentence.\n` +
              `- ecommerceDescription should be 2-4 short sentences max.\n` +
              `- bulletSpecs and keyFeatures should only contain factual visible claims.\n` +
              `- If there is no evidence, leave the field empty.`,
          },
        ],
      },
    ],
  });

  return descriptionSchema.parse(extractJsonObject(responseText(response)));
}
