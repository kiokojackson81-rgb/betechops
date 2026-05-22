import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireRole } from "@/lib/api";

export const runtime = "nodejs";

function sanitizePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]+/g, "-").replace(/-+/g, "-").replace(/^[-/]+|[-/]+$/g, "") || "draft";
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
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

  if (!["main", "gallery", "brand"].includes(kind)) {
    return NextResponse.json({ error: "kind must be main, gallery, or brand" }, { status: 400 });
  }

  const safeName = sanitizePathPart(file.name || `${kind}.jpg`);
  const pathname = `products/${productId}/${kind}-${Date.now()}-${safeName}`;
  const arrayBuffer = await file.arrayBuffer();
  const blob = await put(pathname, Buffer.from(arrayBuffer), {
    access: "public",
    contentType: file.type || "application/octet-stream",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return NextResponse.json({
    url: blob.url,
    key: blob.pathname,
    contentType: file.type || "application/octet-stream",
  });
}
