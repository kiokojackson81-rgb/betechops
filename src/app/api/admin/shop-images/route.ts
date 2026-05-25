import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireRole } from "@/lib/api";
import { isAcceptedImageFile, resolveImageExtension, resolveImageMimeType } from "@/lib/images/uploadImageFormat";
import { getShopImageOverrides, getShopImageSlots, saveShopImageOverrides } from "@/lib/shopImageOverrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readSlot(kind: "hero" | "category", key: string) {
  const slots = await getShopImageSlots();
  return slots.find((slot) => slot.kind === kind && slot.key === key) ?? null;
}

export async function GET() {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const slots = await getShopImageSlots();
  return NextResponse.json({ slots });
}

export async function POST(req: Request) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as { action?: string; slotKind?: "hero" | "category"; slotKey?: string };
    if (body.action !== "reset" || !body.slotKind || !body.slotKey) {
      return NextResponse.json({ error: "Invalid reset request" }, { status: 400 });
    }

    const current = await getShopImageOverrides();
    if (body.slotKind === "hero") {
      current.heroBannerUrl = null;
    } else {
      delete current.categoryImages[body.slotKey];
    }
    await saveShopImageOverrides(current);
    const slot = await readSlot(body.slotKind, body.slotKey);
    return NextResponse.json({ ok: true, slot });
  }

  const form = await req.formData();
  const slotKind = String(form.get("slotKind") ?? "") as "hero" | "category";
  const slotKey = String(form.get("slotKey") ?? "").trim();
  const file = form.get("file");

  if (!slotKey || (slotKind !== "hero" && slotKind !== "category") || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file or slot details" }, { status: 400 });
  }

  if (!isAcceptedImageFile(file)) {
    return NextResponse.json({ error: "Upload a valid image file. Accepted formats: JPG, PNG, WebP, AVIF, GIF, BMP, SVG, TIFF, HEIC, or HEIF." }, { status: 400 });
  }

  const ext = resolveImageExtension(file);
  const mimeType = resolveImageMimeType(file) || "image/png";
  const arrayBuffer = await file.arrayBuffer();
  const blob = await put(`shop-images/${slotKind}-${slotKey}-${Date.now()}.${ext}`, Buffer.from(arrayBuffer), {
    access: "public",
    contentType: mimeType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const current = await getShopImageOverrides();
  if (slotKind === "hero") {
    current.heroBannerUrl = blob.url;
  } else {
    current.categoryImages[slotKey] = blob.url;
  }

  await saveShopImageOverrides(current);
  const slot = await readSlot(slotKind, slotKey);
  return NextResponse.json({ ok: true, slot });
}
