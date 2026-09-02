import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireProductContributor } from "@/lib/productContributor";
import { isAcceptedImageFile, resolveImageExtension, resolveImageMimeType } from "@/lib/images/uploadImageFormat";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await requireProductContributor();
  if (!access.ok) return access.res;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Image storage is not configured" }, { status: 500 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !isAcceptedImageFile(file)) {
    return NextResponse.json({ error: "Upload a valid product image" }, { status: 400 });
  }
  const extension = resolveImageExtension(file);
  const pathname = `contributor-products/${access.userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, "-")}.${extension}`;
  const blob = await put(pathname, Buffer.from(await file.arrayBuffer()), {
    access: "public", contentType: resolveImageMimeType(file) || "image/jpeg", token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return NextResponse.json({ ok: true, url: blob.url });
}
