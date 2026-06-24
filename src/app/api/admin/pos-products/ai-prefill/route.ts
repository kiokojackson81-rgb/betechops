import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { requireRoleOrBrendah } from "@/lib/api";
import { isAcceptedImageFile } from "@/lib/images/uploadImageFormat";
import { sanitizeProductDescription } from "@/lib/productDescriptionFormatting";

export const runtime = "nodejs";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const PRODUCT_DESCRIPTION_FORMAT_STANDARD = `
Use this exact customer-facing product description structure for both shortDescription and description:

🌞 [PRODUCT NAME]
Short tagline.

Introduction paragraph:
A clear 3-5 sentence introduction explaining what the product is, what it does, and who it suits.

## Key Specifications
- Model: [VALUE]
- Product Type: [VALUE]
- Power: [VALUE]
- Voltage: [VALUE]
- Capacity / Flow Rate: [VALUE]
- Head / Lift Height: [VALUE]
- Recommended Panels: [VALUE]
- Pipe Size: [VALUE]
- Warranty: [VALUE]

## Features & Benefits
- Benefit 1
- Benefit 2
- Benefit 3
- Benefit 4

## Ideal Applications
- Application 1
- Application 2
- Application 3
- Application 4

## Package Includes
- 1 x Main Item
- 1 x Accessory / Controller
- User Manual

Rules:
- Keep the description clean, professional, and easy to scan on mobile.
- Output plain text or Markdown only.
- Do not output HTML or XML.
- Do not use <div>, <p>, <h3>, <h4>, <ul>, <ol>, <li>, or any other HTML tags.
- Display one specification per line.
- Do not include prices, hashtags, marketing slogans, transport promises, or contact details.
- Only include facts visible on the image or reliably inferable from visible specifications.
- If a specification is not visible, omit that line instead of guessing.
- Tailor the intro, What It Can Do, and Ideal For sections to the actual product.
`.trim();

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? sanitizeProductDescription(value) : "";
}

function normalizeSellingPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^\d.]/g, "").trim();
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSpecifications(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeOptionalString(item))
      .filter(Boolean)
      .slice(0, 12);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|(?:^|\s)[-*•]\s+|(?<=\.)\s+(?=[A-Z])/)
      .map((item) => item.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 12);
  }

  return [];
}

const aiProductPrefillSchema = z.object({
  name: z.string().trim().default(""),
  brand: z.string().trim().default(""),
  sellingPrice: z.number().nullable().default(null),
  warrantyPeriod: z.string().trim().default(""),
  shortDescription: z.string().trim().default(""),
  description: z.string().trim().default(""),
  specifications: z.array(z.string().trim().min(1)).max(12).default([]),
});

export async function POST(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  if (!client) {
    return NextResponse.json({ error: "OpenAI product analysis is not configured" }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!isAcceptedImageFile(file)) {
    return NextResponse.json({ error: "Upload a valid image file before using AI prefill" }, { status: 400 });
  }

  try {
    const mimeType = file.type || "image/jpeg";
    const base64Image = Buffer.from(await file.arrayBuffer()).toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `You extract truthful ecommerce product details from a single uploaded product poster or sales image. Return only JSON. Do not invent unavailable details. If a field is not visible or not reliably inferable, return an empty string or null. Copy exact visible numbers, capacities, quantities, brands, model names, panel counts, battery sizes, inverter sizes, warranty periods, and inclusion claims from the image. Never upgrade, substitute, round, or rewrite a visible figure into a different one. For example, if the image says 5KW do not output 8KW; if it says 4 panels do not output 10 panels. Write for African buyers and practical Kenyan use cases. If a price is visible, return the numeric amount only with no currency symbols or commas. Warranty should be the clearest visible warranty period. Specifications should be short factual bullet-style strings. The main customer-facing description must follow the required structure exactly. Never output HTML.\n\n${PRODUCT_DESCRIPTION_FORMAT_STANDARD}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Extract and write these fields from this product image: name, brand, sellingPrice, warrantyPeriod, shortDescription, description, specifications. Read the poster carefully and use the exact visible details only. The shortDescription field is the main storefront description, so do not make it short. The description field should contain the same structure, or a slightly fuller version of the same structure, as backup. Follow this format standard exactly for both description fields:\n\n${PRODUCT_DESCRIPTION_FORMAT_STANDARD}\n\nUse the actual visible product name in the intro. Write the main use cases from the poster content. Use only visible or safely inferable technical facts. Put concise factual entries into the specifications array as backup structured data. Do not output HTML tags.`,
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    const parsedJson = JSON.parse(content || "{}");
    const normalizedProduct = {
      name: normalizeOptionalString(parsedJson?.name),
      brand: normalizeOptionalString(parsedJson?.brand),
      sellingPrice: normalizeSellingPrice(parsedJson?.sellingPrice),
      warrantyPeriod: normalizeOptionalString(parsedJson?.warrantyPeriod),
      shortDescription: normalizeOptionalString(parsedJson?.shortDescription),
      description: normalizeOptionalString(parsedJson?.description),
      specifications: normalizeSpecifications(parsedJson?.specifications),
    };
    const parsed = aiProductPrefillSchema.safeParse(normalizedProduct);
    if (!parsed.success) {
      console.error("[admin/pos-products/ai-prefill] invalid AI payload", parsed.error.flatten(), parsedJson);
      throw new Error("AI returned invalid product details");
    }

    return NextResponse.json({ product: parsed.data });
  } catch (error) {
    console.error("[admin/pos-products/ai-prefill] AI product prefill failed", error);
    return NextResponse.json({ error: "AI product prefill failed" }, { status: 500 });
  }
}
