import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireRole } from "@/lib/api";

export const runtime = "nodejs";
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const SPEEDAF_TRACKING_PATTERN = /^KE\d{18}$/;

function extractSpeedafTrackingNumbers(value: string) {
  const candidates = value.toUpperCase().match(/K\s*E(?:[\s:.-]*\d){18}/g) ?? [];
  return [...new Set(candidates.map((candidate) => candidate.replace(/[^A-Z0-9]/g, "")).filter((candidate) => SPEEDAF_TRACKING_PATTERN.test(candidate)))];
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return NextResponse.json({ error: "Upload a Speedaf receipt image." }, { status: 400 });
  if (!client) return NextResponse.json({ trackingNumbers: [] });
  const image = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  try {
    const response = await client.chat.completions.create({ model: "gpt-4.1", temperature: 0, messages: [{ role: "system", content: "You extract Speedaf Kenya barcode tracking numbers with high precision. The valid printed code is exactly 20 characters: KE followed by exactly 18 digits. It is normally printed immediately below the barcode. The photo may be rotated; mentally rotate it before reading. Read the barcode label character-by-character. Do not use route codes, COD numbers, phone numbers, dates, page counts, or partial codes. Return only valid tracking numbers, one per line. Before returning, verify every number matches KE followed by 18 digits exactly. If uncertain, return nothing rather than guessing." }, { role: "user", content: [{ type: "image_url", image_url: { url: image, detail: "high" } }] }] });
    const trackingNumbers = extractSpeedafTrackingNumbers(String(response.choices[0]?.message?.content || ""));
    return NextResponse.json({ trackingNumbers });
  } catch { return NextResponse.json({ trackingNumbers: [] }); }
}
