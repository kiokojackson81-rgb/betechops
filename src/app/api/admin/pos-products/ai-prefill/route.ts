import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { requireRoleOrBrendah } from "@/lib/api";
import { isAcceptedImageFile } from "@/lib/images/uploadImageFormat";

export const runtime = "nodejs";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract truthful ecommerce product details from a single uploaded product poster or sales image. Return only JSON. Do not invent unavailable details. If a field is not visible or not reliably inferable, return an empty string or null. Description writing rules: write for African buyers, explain what the product can power in practical everyday use, keep the tone convincing but honest, and only mention installation or transportation if the image explicitly says they are included. The full description must not be a one-line summary. Write a fuller customer-facing description with at least 3 substantial sentences when enough information is visible: what the product is, who it is for, and the practical home/business devices or use cases it supports. If a price is visible, return the numeric amount only with no currency symbols or commas. Warranty should be the clearest visible warranty period. Specifications should be short factual bullet-style strings.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract and write these fields from this product image: name, brand, sellingPrice, warrantyPeriod, shortDescription, description, specifications. The short description should be brief and sales-ready. The full description should be fuller than the short description, customer-facing, practical, and focused on real power use cases. Write it as a proper marketing-ready product description, not a single line. Describe what the product is, where it is commonly used, and what it can power or support in realistic terms based on the visible product type and details. If an all-inclusive system clearly includes transport or installation, mention that truthfully in the description. Otherwise do not mention them. Put technical points into the specifications array as concise bullet-style entries.",
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
