import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findAccessibleCommissioningSession } from "@/lib/commissioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const requestSchema = z.object({
  kind: z.enum(["panel", "inverter", "battery"]),
  imageUrl: z.string().url(),
});
type ParamsContext = { params: Promise<{ token: string }> | { token: string } };

export async function POST(req: NextRequest, context: ParamsContext) {
  const { token } = await context.params;
  const session = await findAccessibleCommissioningSession(token);
  if (!session || session.status !== "DRAFT")
    return NextResponse.json(
      { error: "This commissioning session is unavailable." },
      { status: 404 },
    );
  if (!client)
    return NextResponse.json(
      {
        error:
          "AI label reading is not configured. Enter the equipment details manually.",
      },
      { status: 503 },
    );
  const parsed = requestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid label image." },
      { status: 400 },
    );
  const prompt = `Read this ${parsed.data.kind} equipment label. Return JSON only with keys brand, model, serial, ratedPower, voltage, capacity. The serial is especially important: look for S/N, SN, Serial No, Serial Number, barcode-adjacent identifiers, or a manufacturer code. Copy it exactly, including hyphens and leading zeroes. Do not use the model number as a serial number. Use empty strings for unreadable values; do not invent readings.`;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: parsed.data.imageUrl, detail: "high" },
            },
          ],
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    // JSON mode should return an object, but accepting a fenced response keeps
    // an otherwise good label reading from being discarded by formatting.
    const values = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as Record<string, unknown>;
    const stringValue = (...keys: string[]) => {
      const value = keys.map((key) => values[key]).find((item) => typeof item === "string");
      return typeof value === "string" ? value.trim() : "";
    };
    const equipment = Object.fromEntries(
      [
        ["brand", ["brand", "manufacturer"]],
        ["model", ["model", "modelNumber", "model_number"]],
        ["serial", ["serial", "serialNumber", "serial_number", "serialNo", "serial_no", "sn"]],
        ["ratedPower", ["ratedPower", "rated_power", "power"]],
        ["voltage", ["voltage"]],
        ["capacity", ["capacity", "rating"]],
      ].map(([key, aliases]) => [key, stringValue(...aliases)]),
    );
    const identified = Boolean(
      equipment.brand || equipment.model || equipment.serial,
    );
    return NextResponse.json({ ok: true, identified, equipment });
  } catch (error) {
    console.error("[commissioning] label extraction failed", error);
    return NextResponse.json(
      {
        error:
          "We couldn't clearly read this label. Retake the photo or enter details manually.",
      },
      { status: 422 },
    );
  }
}
