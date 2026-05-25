import { z } from "zod";
import { SHOP_CATEGORY_DEFINITIONS } from "@/app/shop/shopCatalogConfig";
import { extractJsonObject, getOpenAiClient, responseText } from "@/lib/ai/openai";

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

const ocrSchema = z.object({
  titleHint: z.preprocess(normalizeAiString, z.string().default("")),
  brand: z.preprocess(normalizeAiString, z.string().default("")),
  shopCategory: z.preprocess(normalizeAiString, z.string().default("")),
  shopSubcategory: z.preprocess(normalizeAiString, z.string().default("")),
  visibleSpecs: z.preprocess(normalizeAiStringArray, z.array(z.string()).default([])),
  keyFeatures: z.preprocess(normalizeAiStringArray, z.array(z.string()).default([])),
  usageExamples: z.preprocess(normalizeAiStringArray, z.array(z.string()).default([])),
  accessoryItems: z.preprocess(normalizeAiStringArray, z.array(z.string()).default([])),
  textToRemove: z.preprocess(normalizeAiStringArray, z.array(z.string()).default([])),
  ignoredMarketingText: z.preprocess(normalizeAiStringArray, z.array(z.string()).default([])),
  notes: z.preprocess(normalizeAiStringArray, z.array(z.string()).default([])),
});

export type ProductOcrResult = z.infer<typeof ocrSchema>;

export async function extractProductFactsFromImage(imageUrl: string) {
  const client = getOpenAiClient();
  const categoryGuide = SHOP_CATEGORY_DEFINITIONS.map((category) => ({
    category: category.value,
    label: category.label,
    subcategories: category.subcategories.map((subcategory) => subcategory.value),
  }));

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You inspect supplier product posters for a solar/electrical ecommerce desk. Extract only visible, supportable product facts. Ignore or separate prices, phone numbers, promotions, watermarks, warranty badges, and marketing fluff. Return only JSON.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `Review this image and return JSON with these exact keys: titleHint, brand, shopCategory, shopSubcategory, visibleSpecs, keyFeatures, usageExamples, accessoryItems, textToRemove, ignoredMarketingText, notes.\n` +
              `Pick shopCategory/shopSubcategory only from this list when there is enough evidence:\n${JSON.stringify(categoryGuide)}\n` +
              `Rules:\n` +
              `- Keep strings short and professional.\n` +
              `- visibleSpecs should contain only factual specs visible in the image.\n` +
              `- textToRemove should list obvious prices, phone numbers, promo banners, or supplier sticker text that should be removed during cleanup.\n` +
              `- If unsure, leave fields blank instead of guessing.`,
          },
          {
            type: "input_image",
            image_url: imageUrl,
            detail: "high",
          },
        ],
      },
    ],
  });

  return ocrSchema.parse(extractJsonObject(responseText(response)));
}
