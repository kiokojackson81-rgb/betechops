import { z } from "zod";
import { SHOP_CATEGORY_DEFINITIONS } from "@/app/shop/shopCatalogConfig";
import { extractJsonObject, getOpenAiClient, responseText } from "@/lib/ai/openai";

const ocrSchema = z.object({
  titleHint: z.string().default(""),
  brand: z.string().default(""),
  shopCategory: z.string().default(""),
  shopSubcategory: z.string().default(""),
  visibleSpecs: z.array(z.string()).default([]),
  keyFeatures: z.array(z.string()).default([]),
  usageExamples: z.array(z.string()).default([]),
  accessoryItems: z.array(z.string()).default([]),
  textToRemove: z.array(z.string()).default([]),
  ignoredMarketingText: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
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
