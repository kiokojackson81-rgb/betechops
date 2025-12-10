import OpenAI from "openai";
import { NextRequest } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

export async function POST(req: NextRequest) {
  try {
    const { items, paymentMethod } = await req.json();
    const safeItems = Array.isArray(items) ? items : [];

    const itemList = safeItems
      .map((it: any, index: number) => `${index + 1}. ${it.description ?? ""}`)
      .join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You write short, professional receipt notes for a solar/electrical shop in Kenya. 3–6 short lines. No prices or tax explanation.",
        },
        {
          role: "user",
          content: `Customer bought these items:\n${itemList}\n\nPayment method: ${
            paymentMethod ?? "Not specified"
          }.\n\nWrite general notes/terms suitable for the bottom of a receipt. Include: items supplied in good condition, basic warranty/returns wording, and payment confirmation.`,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ notes: content.trim() }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[receipt-notes] AI error", err);
    return new Response(JSON.stringify({ error: "AI error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
