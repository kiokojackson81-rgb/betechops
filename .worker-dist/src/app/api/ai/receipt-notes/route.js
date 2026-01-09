"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const openai_1 = __importDefault(require("openai"));
const client = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY ?? "",
});
async function POST(req) {
    try {
        const { items, paymentMethod } = await req.json();
        const safeItems = Array.isArray(items) ? items : [];
        const itemList = safeItems
            .map((it, index) => `${index + 1}. ${it.description ?? ""}`)
            .join("\n");
        const completion = await client.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.3,
            messages: [
                {
                    role: "system",
                    content: "You are a helpful copywriter for a Kenyan solar/electrical shop producing short, professional receipt notes. Use your judgment to choose the best clear formatting for the information — single sentences, short paragraphs, bullet lists ('-' for bullets), or numbered lists — whichever makes the note most useful on a printed receipt. Emphasize key phrases with **bold** when helpful. Keep output concise and customer-friendly (roughly 2–6 short lines when rendered). Do NOT include prices, tax calculations, or internal debug info. Return only the note text in Markdown format.",
                },
                {
                    role: "user",
                    content: `Customer bought these items:\n${itemList}\n\nPayment method: ${paymentMethod ?? "Not specified"}.\n\nWrite general notes/terms suitable for the bottom of a receipt. Include statements about items supplied in good condition, basic warranty/returns guidance, and payment confirmation. Use whichever formatting (sentences, short paragraphs, bullets, or numbers) makes the notes most clear and professional on a printed receipt. Return ONLY the notes in Markdown format.`,
                },
            ],
        });
        const notes = completion.choices?.[0]?.message?.content ?? "";
        return new Response(JSON.stringify({ notes: notes.trim() }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
    catch (err) {
        console.error("[receipt-notes] AI error", err);
        return new Response(JSON.stringify({ error: "AI error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
