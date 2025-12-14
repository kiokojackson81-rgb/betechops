import OpenAI from "openai";
import { NextRequest } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

export async function POST(req: NextRequest) {
  try {
    const { rawDescription } = await req.json();

    if (!rawDescription || !rawDescription.toString().trim()) {
      return new Response(JSON.stringify({ error: "rawDescription is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You clean up product descriptions for receipts in a solar/electrical shop. Output should be short and professional. Return the result in Markdown if multiple sub-points are useful (use '-' for bullets). No prices, no warranty, no extra comments. Return ONLY the final description in Markdown/plain text.",
        },
        {
          role: "user",
          content: `Turn this into a clean receipt line description:\n"${rawDescription}"\n\nReturn ONLY the final description text (Markdown allowed).`,
        },
      ],
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ description: content.trim() }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[receipt-description] AI error", err);
    return new Response(JSON.stringify({ error: "AI error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
