import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireRole } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const form = await req.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "general").trim() || "general";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob storage is not configured" }, { status: 500 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const pathname = `wellness/${folder}/${Date.now()}-${safeName}`;
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
