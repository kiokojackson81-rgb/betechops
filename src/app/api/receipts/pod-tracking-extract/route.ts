import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireRole } from "@/lib/api";

export const runtime = "nodejs";
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return NextResponse.json({ error: "Upload a Speedaf receipt image." }, { status: 400 });
  if (!client) return NextResponse.json({ trackingNumbers: [] });
  const image = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  try {
    const response = await client.chat.completions.create({ model: "gpt-4.1", temperature: 0, messages: [{ role: "system", content: "Read this Speedaf shipping receipt. Return only every visible tracking number, one per line. Do not invent values." }, { role: "user", content: [{ type: "image_url", image_url: { url: image, detail: "high" } }] }] });
    const trackingNumbers = String(response.choices[0]?.message?.content || "").split(/\s+/).map((value) => value.replace(/[^A-Za-z0-9-]/g, "")).filter((value) => /[A-Za-z]/.test(value) && /\d/.test(value) && value.length >= 8);
    return NextResponse.json({ trackingNumbers: [...new Set(trackingNumbers)] });
  } catch { return NextResponse.json({ trackingNumbers: [] }); }
}
