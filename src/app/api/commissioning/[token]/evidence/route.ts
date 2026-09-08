import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { findAccessibleCommissioningSession } from "@/lib/commissioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ token: string }> | { token: string } };

export async function POST(req: Request, context: ParamsContext) {
  const { token } = await context.params;
  const session = await findAccessibleCommissioningSession(token);
  if (!session) return NextResponse.json({ error: "This commissioning link is invalid, revoked, or expired." }, { status: 404 });
  if (session.status !== "DRAFT") return NextResponse.json({ error: "Certificate Issued — View Only" }, { status: 409 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Evidence storage is not configured." }, { status: 503 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Upload an image file." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Each photo must be 10 MB or smaller." }, { status: 400 });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "evidence.jpg";
  const blob = await put(`commissioning/${session.id}/${Date.now()}-${safeName}`, Buffer.from(await file.arrayBuffer()), {
    access: "public",
    contentType: file.type,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return NextResponse.json({ url: blob.url, key: blob.pathname, contentType: file.type, fileName: file.name, size: file.size });
}
