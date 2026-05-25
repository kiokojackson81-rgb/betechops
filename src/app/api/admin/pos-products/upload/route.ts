import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireRoleOrBrendah } from "@/lib/api";
import { isAcceptedImageFile, resolveImageExtension, resolveImageMimeType } from "@/lib/images/uploadImageFormat";

export const runtime = "nodejs";

function sanitizePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]+/g, "-").replace(/-+/g, "-").replace(/^[-/]+|[-/]+$/g, "") || "draft";
}

export async function POST(req: Request) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob storage is not configured" }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "gallery").trim().toLowerCase();
  const productId = sanitizePathPart(String(form.get("productId") ?? "draft"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!isAcceptedImageFile(file)) {
    return NextResponse.json({ error: "Upload a valid image file. Accepted formats: JPG, PNG, WebP, AVIF, GIF, BMP, SVG, TIFF, HEIC, or HEIF." }, { status: 400 });
  }

  if (!["main", "gallery", "brand"].includes(kind)) {
    return NextResponse.json({ error: "kind must be main, gallery, or brand" }, { status: 400 });
  }

  const normalizedExtension = resolveImageExtension(file);
  const normalizedMimeType = resolveImageMimeType(file) || "image/jpeg";
  const baseName = sanitizePathPart((file.name || `${kind}.${normalizedExtension}`).replace(/\.[^.]+$/, ""));
  const pathname = `products/${productId}/${kind}-${Date.now()}-${baseName}.${normalizedExtension}`;
  const arrayBuffer = await file.arrayBuffer();
  const blob = await put(pathname, Buffer.from(arrayBuffer), {
    access: "public",
    contentType: normalizedMimeType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return NextResponse.json({
    url: blob.url,
    key: blob.pathname,
    contentType: normalizedMimeType,
  });
}
