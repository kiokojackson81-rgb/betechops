"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const openai_1 = __importDefault(require("openai"));
const server_1 = require("next/server");
function titleCase(str) {
    return str
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
        .join(" ");
}
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";
const useOpenAI = Boolean(OPENAI_KEY);
const client = useOpenAI
    ? new openai_1.default({ apiKey: OPENAI_KEY })
    : null;
async function POST(req) {
    try {
        const body = await req.json().catch(() => ({}));
        const raw = String(body?.rawAddress ?? "").trim();
        if (!raw)
            return server_1.NextResponse.json({ error: "Missing rawAddress" }, { status: 400 });
        // If OpenAI is available, call it to do a lightweight normalization
        if (useOpenAI && client) {
            try {
                const messages = [
                    {
                        role: "system",
                        content: "You are a helpful assistant that normalizes delivery addresses for Kenya. Return a single concise, human-readable normalized address. Fix common spacing/casing issues, expand obvious abbreviations (e.g., 'Rd' -> 'Road', 'St' -> 'Street') but do not invent missing city/county names. Output ONLY the normalized address text with no commentary.",
                    },
                    { role: "user", content: `Normalize this address: ${raw}` },
                ];
                const completion = await client.chat.completions.create({
                    model: "gpt-4o-mini",
                    // cast messages to any to satisfy TypeScript overloads in this SDK
                    messages: messages,
                    temperature: 0.0,
                    max_tokens: 200,
                });
                const content = completion.choices?.[0]?.message?.content ?? "";
                const normalized = String(content).trim();
                // final safeguard: collapse whitespace
                const collapsed = normalized.replace(/\s+/g, " ");
                return server_1.NextResponse.json({ address: collapsed });
            }
            catch (aiErr) {
                console.warn("[address-correct] OpenAI failed, falling back", aiErr);
                // fallback to simple normalization below
            }
        }
        // Simple normalization fallback: collapse whitespace, title case, keep numbers intact
        const collapsed = raw.replace(/\s+/g, " ");
        const normalized = titleCase(collapsed);
        return server_1.NextResponse.json({ address: normalized });
    }
    catch (e) {
        return server_1.NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
