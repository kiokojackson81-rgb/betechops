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
      model: "gpt-4.1",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract truthful ecommerce product details from a single uploaded product poster or sales image. Return only JSON. Do not invent unavailable details. If a field is not visible or not reliably inferable, return an empty string or null. Copy exact visible numbers, capacities, quantities, brands, model names, panel counts, battery sizes, inverter sizes, warranty periods, and inclusion claims from the image. Never upgrade, substitute, round, or rewrite a visible figure into a different one. For example, if the image says 5KW do not output 8KW; if it says 4 panels do not output 10 panels. Write for African buyers and practical Kenyan use cases. If a price is visible, return the numeric amount only with no currency symbols or commas. Warranty should be the clearest visible warranty period. Specifications should be short factual bullet-style strings. The main customer-facing description must be rich and properly structured, not a one-line summary. Format it cleanly with short paragraphs, section labels, bullet-style lines, and emphasis markers like **bold** where useful. When the image is a full system package or contains enough details, write a long-form customer-facing description with sections supported by the image, such as: Price, System Components, Key Features, Warranty, What This System Can Power, Ideal For, and Package Benefits. Only mention installation, transportation, included accessories, or nationwide service if the image explicitly says they are included.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract and write these fields from this product image: name, brand, sellingPrice, warrantyPeriod, shortDescription, description, specifications. Read the poster carefully and use the exact visible details only. The shortDescription field is the main storefront description, so do not make it short. Put the full rich formatted product write-up there. It should be detailed, well formatted, and ready for customers to read, using paragraphs, section labels, bullet-style lines, and **bold** emphasis where helpful. Do not guess or substitute similar system details. The description field should also contain the same or slightly expanded rich description as a backup. For solar systems and bundled packages, write a proper long-form product description similar to a catalogue entry. Start with a short opening overview paragraph, then include clear sections when visible from the image: Price, System Components, Key Features, Warranty, What This System Can Power, Ideal For, and Package Benefits. Under those sections, include concise bullet-style lines in plain text. Be convincing but truthful. Describe what the system can power in realistic home, office, farm, or business use based only on the visible wattage, battery, inverter, panel count, or written claims. Only mention transport, installation, all-inclusive accessories, or nationwide coverage if the image explicitly confirms them. Put core technical points into the specifications array as concise factual entries.",
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
