import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireRoleOrBrendah } from "@/lib/api";
import { isAcceptedImageFile } from "@/lib/images/uploadImageFormat";

export const runtime = "nodejs";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function buildImageDataUrl(file: File) {
  const mimeType = file.type || "image/jpeg";
  const base64Image = Buffer.from(await file.arrayBuffer()).toString("base64");
  return `data:${mimeType};base64,${base64Image}`;
}

export async function POST(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  if (!client) {
    return NextResponse.json({ error: "OpenAI OCR is not configured" }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const imageUrl = String(form.get("imageUrl") || "").trim();

  let imageInputUrl = "";
  if (file instanceof File) {
    if (!isAcceptedImageFile(file)) {
      return NextResponse.json({ error: "Upload a valid image file before extracting text" }, { status: 400 });
    }
    imageInputUrl = await buildImageDataUrl(file);
  } else if (imageUrl) {
    imageInputUrl = imageUrl;
  } else {
    return NextResponse.json({ error: "file or imageUrl is required" }, { status: 400 });
  }

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You perform OCR for ecommerce product images. Return plain text only. Copy visible text faithfully. Keep line breaks where helpful. Do not summarize. Do not add commentary. Do not invent missing text.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all clearly visible text from this product image. Return plain text only." },
            { type: "image_url", image_url: { url: imageInputUrl, detail: "high" } },
          ],
        },
      ],
    });

    const text = String(completion.choices?.[0]?.message?.content || "").trim();
    return NextResponse.json({ text });
  } catch (error) {
    console.error("[admin/pos-products/ai-ocr] OCR extraction failed", error);
    return NextResponse.json({ error: "OCR extraction failed" }, { status: 500 });
  }
}
