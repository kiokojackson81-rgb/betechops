import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { requireRoleOrBrendah } from "@/lib/api";
import { isAcceptedImageFile } from "@/lib/images/uploadImageFormat";
import {
  PRODUCT_GALLERY_AI_HEIGHT,
  PRODUCT_GALLERY_AI_PROMPT,
  PRODUCT_GALLERY_AI_WIDTH,
} from "@/lib/images/productGalleryAi";

export const runtime = "nodejs";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function POST(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  if (!client) {
    return NextResponse.json({ error: "OpenAI image editing is not configured" }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!isAcceptedImageFile(file)) {
    return NextResponse.json({ error: "Upload a valid image file before using AI redesign" }, { status: 400 });
  }

  try {
    const inputFile = await toFile(Buffer.from(await file.arrayBuffer()), file.name || "product-image.jpg", {
      type: file.type || "image/jpeg",
    });

    const response = await client.images.edit({
      model: "gpt-image-2" as any,
      image: inputFile,
      prompt: PRODUCT_GALLERY_AI_PROMPT,
      size: "1776x896" as any,
      quality: "medium" as any,
      input_fidelity: "low" as any,
      output_format: "jpeg",
      output_compression: 82,
      background: "opaque",
      user: (auth.session?.user as { id?: string } | undefined)?.id,
    } as any);

    const imageBase64 = response.data?.[0]?.b64_json;
    if (!imageBase64) {
      throw new Error("OpenAI did not return an edited image");
    }

    return NextResponse.json({
      imageBase64,
      mimeType: "image/jpeg",
      width: PRODUCT_GALLERY_AI_WIDTH,
      height: PRODUCT_GALLERY_AI_HEIGHT,
    });
  } catch (error) {
    console.error("[admin/pos-products/ai-image] AI image edit failed", error);
    return NextResponse.json({ error: "AI image redesign failed" }, { status: 500 });
  }
}
