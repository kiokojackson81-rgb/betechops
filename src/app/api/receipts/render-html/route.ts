import { NextResponse } from "next/server";
import renderReceiptTemplate from "@/app/templates/receiptTemplate";
import { getBranding } from "@/lib/branding";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const draft = body?.draft;

  if (!draft) {
    const res = NextResponse.json({ error: "Missing draft" }, { status: 400 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const branding = await getBranding();
  const html = renderReceiptTemplate(
    { ...(draft as any), branding },
    { hideStamp: false, hideItemWarrantySummary: true }
  );

  const res = NextResponse.json({ html });
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Receipt-Renderer", "template");
  res.headers.set("X-Receipt-Commit", process.env.VERCEL_GIT_COMMIT_SHA || "unknown");

  const letterhead = (branding as any)?.letterheadUrl || process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || "none";
  res.headers.set("X-Receipt-Letterhead", String(letterhead).slice(0, 120));

  return res;
}
