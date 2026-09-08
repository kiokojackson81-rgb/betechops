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
  const prompt = `Read this ${parsed.data.kind} equipment label. Return JSON only with keys brand, model, serial, ratedPower, voltage, capacity. Use empty strings for unreadable values. Do not invent readings.`;
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
    const values = JSON.parse(raw) as Record<string, unknown>;
    const equipment = Object.fromEntries(
      ["brand", "model", "serial", "ratedPower", "voltage", "capacity"].map(
        (key) => [
          key,
          typeof values[key] === "string" ? values[key].trim() : "",
        ],
      ),
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
