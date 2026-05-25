import OpenAI, { toFile } from "openai";
import { put } from "@vercel/blob";
import { getOpenAiClient } from "@/lib/ai/openai";

export type ProductImageCleanupOptions = {
  transparentBackground?: boolean;
  removeAllText?: boolean;
  keepSupplierLogo?: boolean;
  generateBanner?: boolean;
};

export type ProductImageCleanupResult = {
  sourceImageUrl: string;
  sourceImageKey: string;
  cleanImageUrl: string;
  transparentImageUrl?: string;
  thumbnailUrl: string;
  bannerImageUrl: string;
  notes: string[];
};

async function fetchImageAsset(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download source image (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const bytes = Buffer.from(arrayBuffer);
  const url = new URL(imageUrl);
  const fileName = url.pathname.split("/").pop() || "source-image.jpg";
  return { bytes, contentType, fileName };
}

async function uploadAiAsset(pathname: string, bytes: Buffer, contentType: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Blob storage is not configured");
  }

  const blob = await put(pathname, bytes, {
    access: "public",
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return { url: blob.url, key: blob.pathname };
}

async function createEditedImage(params: {
  client: OpenAI;
  sourceFile: File;
  prompt: string;
  background: "opaque" | "transparent";
  size: "1536x1024" | "1024x1024";
  outputFormat: "jpeg" | "png";
  quality?: "low" | "medium" | "high" | "auto";
}) {
  const response = await params.client.images.edit({
    model: "gpt-image-1",
    image: params.sourceFile,
    prompt: params.prompt,
    background: params.background,
    size: params.size,
    output_format: params.outputFormat,
    quality: params.quality ?? "medium",
  });

  const encoded = response.data?.[0]?.b64_json;
  if (!encoded) {
    throw new Error("AI image cleanup returned no image data");
  }

  return Buffer.from(encoded, "base64");
}

export async function cleanSupplierPosterToShopAssets(input: {
  imageUrl: string;
  productId?: string | null;
  options?: ProductImageCleanupOptions;
}) {
  const client = getOpenAiClient();
  const { bytes, contentType, fileName } = await fetchImageAsset(input.imageUrl);
  const safeBase = `${(input.productId || "draft").replace(/[^a-zA-Z0-9_-]+/g, "-")}-${Date.now()}`;
  const sourceFile = await toFile(bytes, fileName, { type: contentType });

  const removeLogosInstruction = input.options?.keepSupplierLogo
    ? "Preserve the supplier logo only when it is physically printed on the product hardware."
    : "Remove supplier logos, banners, brand watermarks, and phone numbers unless they are physically part of the product body.";
  const textInstruction = input.options?.removeAllText === false
    ? "Keep factual product markings that are physically printed on the hardware."
    : "Remove visible prices, sales text, phone numbers, promo stickers, banners, labels, warranty badges, and all non-product text from the scene.";
  const basePrompt =
    "Convert this supplier marketing poster into a clean ecommerce product image. " +
    "Keep the real hardware product and any genuine included accessories. " +
    "Do not invent or change the product shape, color, or included items. " +
    "Center the product cleanly with balanced margins on a studio-ready background. " +
    `${textInstruction} ${removeLogosInstruction}`;

  const original = await uploadAiAsset(`uploads/products/original/${safeBase}.jpg`, bytes, contentType);
  const cleanMain = await createEditedImage({
    client,
    sourceFile,
    prompt: `${basePrompt} Use a clean white background. Output a premium 4:3 storefront product image.`,
    background: "opaque",
    size: "1536x1024",
    outputFormat: "jpeg",
    quality: "high",
  });
  const cleanMainUpload = await uploadAiAsset(`uploads/products/clean/${safeBase}.jpg`, cleanMain, "image/jpeg");

  const squareThumb = await createEditedImage({
    client,
    sourceFile,
    prompt: `${basePrompt} Create a square thumbnail crop with the product fully visible and centered on a white background.`,
    background: "opaque",
    size: "1024x1024",
    outputFormat: "jpeg",
    quality: "medium",
  });
  const thumbUpload = await uploadAiAsset(`uploads/products/thumbs/${safeBase}.jpg`, squareThumb, "image/jpeg");

  let transparentUpload: { url: string; key: string } | null = null;
  if (input.options?.transparentBackground !== false) {
    const transparent = await createEditedImage({
      client,
      sourceFile,
      prompt: `${basePrompt} Output only the isolated product on a transparent background with clean edges.`,
      background: "transparent",
      size: "1024x1024",
      outputFormat: "png",
      quality: "high",
    });
    transparentUpload = await uploadAiAsset(`uploads/products/transparent/${safeBase}.png`, transparent, "image/png");
  }

  const bannerUrl = cleanMainUpload.url;
  if (input.options?.generateBanner) {
    await uploadAiAsset(`uploads/products/banners/${safeBase}.jpg`, cleanMain, "image/jpeg");
  }

  return {
    sourceImageUrl: original.url,
    sourceImageKey: original.key,
    cleanImageUrl: cleanMainUpload.url,
    transparentImageUrl: transparentUpload?.url,
    thumbnailUrl: thumbUpload.url,
    bannerImageUrl: bannerUrl,
    notes: [
      "Generated white-background storefront image.",
      transparentUpload ? "Generated transparent PNG variant." : "Transparent PNG generation skipped.",
      "Generated square thumbnail preview.",
    ],
  } satisfies ProductImageCleanupResult;
}
