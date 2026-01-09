"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const openai_1 = __importDefault(require("openai"));
const prisma_1 = require("@/lib/prisma");
const api_1 = require("@/lib/api");
exports.dynamic = "force-dynamic";
// Simple in-memory sliding-window rate limiter (per-IP key). This is a
// best-effort limiter suitable for low-volume admin UX. For production-scale
// protections consider using a centralized store (Redis) or the infrastructure
// provider's rate-limiting features.
const WINDOW_MS = Number(process.env.AI_NORMALIZE_WINDOW_MS || "60000");
const MAX_PER_WINDOW = Number(process.env.AI_NORMALIZE_MAX_PER_WINDOW || "6");
const _requests = new Map();
function allowRequest(key) {
    const now = Date.now();
    const arr = _requests.get(key) || [];
    // drop old entries
    const recent = arr.filter((t) => t > now - WINDOW_MS);
    if (recent.length >= MAX_PER_WINDOW) {
        _requests.set(key, recent);
        return false;
    }
    recent.push(now);
    _requests.set(key, recent);
    return true;
}
function localNormalize(name) {
    if (!name)
        return "";
    const s = name.replace(/\s+/g, " ").trim();
    if (!s)
        return "";
    const words = s.split(" ").map((w) => {
        const hyphenParts = w.split("-").map((hp) => {
            const aposParts = hp.split("'").map((ap) => (ap ? ap.charAt(0).toUpperCase() + ap.slice(1).toLowerCase() : ap));
            return aposParts.join("'");
        });
        return hyphenParts.join("-");
    });
    return words.join(" ");
}
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY ?? "" });
async function POST(req) {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    if (!name)
        return server_1.NextResponse.json({ error: "Missing name" }, { status: 400 });
    // Determine a per-request key (prefer client IP if present)
    const ip = String(req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || req.headers.get("x-ms-client-principal-id") || "global").split(",")[0];
    const rateKey = `normalize-name:${ip}`;
    if (!allowRequest(rateKey)) {
        return server_1.NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    // Prepare a lightweight audit record we will persist after the call
    const auditBase = { input: { name }, model: null, ok: false };
    // If OpenAI API key is not configured, fall back to local deterministic normalization
    if (!process.env.OPENAI_API_KEY) {
        const normalizedName = localNormalize(name);
        try {
            await prisma_1.prisma.actionLog.create({ data: { actorId: "system", entity: "AI", entityId: "normalize-name", action: "NORMALIZE", before: { input: name }, after: { normalizedName, provider: "local" } } });
        }
        catch (e) {
            // non-fatal
            console.warn("Failed to persist AI action log", e);
        }
        // Persist to receipt if receiptId provided
        const receiptId = String(body?.receiptId ?? "").trim();
        if (receiptId) {
            try {
                const rec = await prisma_1.prisma.receipt.findUnique({ where: { id: receiptId }, include: { order: true } });
                if (rec) {
                    const before = rec;
                    if (rec.order && rec.order.id) {
                        await prisma_1.prisma.order.update({ where: { id: rec.order.id }, data: { customerName: normalizedName } });
                    }
                    else {
                        const baseData = typeof rec.data === "object" && rec.data ? { ...rec.data } : {};
                        baseData["customerName"] = normalizedName;
                        await prisma_1.prisma.receipt.update({ where: { id: receiptId }, data: { data: baseData } });
                    }
                    try {
                        const actorId = (await (0, api_1.getActorId)()) || "system";
                        await prisma_1.prisma.actionLog.create({ data: { actorId, entity: "Receipt", entityId: receiptId, action: "NORMALIZE_NAME", before: before, after: { normalizedName } } });
                    }
                    catch (e) {
                        console.warn("Failed to persist receipt action log", e);
                    }
                }
            }
            catch (e) {
                console.warn("Failed to persist normalized name to receipt", e);
            }
        }
        return server_1.NextResponse.json({ normalizedName });
    }
    try {
        // Use the same model and client pattern as other AI endpoints in the codebase
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.0,
            messages: [
                { role: "system", content: "You are a text normalizer that corrects capitalization for customer names. Return ONLY the corrected name with professional capitalization. Do not add punctuation or extra commentary." },
                { role: "user", content: `Normalize this customer name: "${name}"` },
            ],
            max_tokens: 64,
        });
        const normalizedName = String(completion.choices?.[0]?.message?.content ?? "").trim();
        auditBase.model = "gpt-4o-mini";
        auditBase.ok = true;
        try {
            await prisma_1.prisma.actionLog.create({ data: { actorId: "system", entity: "AI", entityId: "normalize-name", action: "NORMALIZE", before: { input: name }, after: { normalizedName, model: auditBase.model } } });
        }
        catch (e) {
            console.warn("Failed to persist AI action log", e);
        }
        // If the model returned an empty string, fall back to local
        const finalName = normalizedName || localNormalize(name);
        // Persist to receipt if receiptId provided
        const receiptId = String(body?.receiptId ?? "").trim();
        if (receiptId) {
            try {
                const rec = await prisma_1.prisma.receipt.findUnique({ where: { id: receiptId }, include: { order: true } });
                if (rec) {
                    const before = rec;
                    if (rec.order && rec.order.id) {
                        await prisma_1.prisma.order.update({ where: { id: rec.order.id }, data: { customerName: finalName } });
                    }
                    else {
                        const baseData = typeof rec.data === "object" && rec.data ? { ...rec.data } : {};
                        baseData["customerName"] = finalName;
                        await prisma_1.prisma.receipt.update({ where: { id: receiptId }, data: { data: baseData } });
                    }
                    try {
                        const actorId = (await (0, api_1.getActorId)()) || "system";
                        await prisma_1.prisma.actionLog.create({ data: { actorId, entity: "Receipt", entityId: receiptId, action: "NORMALIZE_NAME", before: before, after: { normalizedName: finalName } } });
                    }
                    catch (e) {
                        console.warn("Failed to persist receipt action log", e);
                    }
                }
            }
            catch (e) {
                console.warn("Failed to persist normalized name to receipt", e);
            }
        }
        return server_1.NextResponse.json({ normalizedName: finalName });
    }
    catch (err) {
        console.error("[ai.normalize-name] error", err);
        // Persist failure audit
        try {
            await prisma_1.prisma.actionLog.create({ data: { actorId: "system", entity: "AI", entityId: "normalize-name", action: "NORMALIZE_FAILED", before: { input: name }, after: { error: String(err) } } });
        }
        catch (e) {
            // ignore
        }
        // graceful fallback to local deterministic normalization
        const normalizedName = localNormalize(name);
        // Attempt to persist fallback to receipt if receiptId present
        const receiptId = String(body?.receiptId ?? "").trim();
        if (receiptId) {
            try {
                const rec = await prisma_1.prisma.receipt.findUnique({ where: { id: receiptId }, include: { order: true } });
                if (rec) {
                    const before = rec;
                    if (rec.order && rec.order.id) {
                        await prisma_1.prisma.order.update({ where: { id: rec.order.id }, data: { customerName: normalizedName } });
                    }
                    else {
                        const baseData = typeof rec.data === "object" && rec.data ? { ...rec.data } : {};
                        baseData["customerName"] = normalizedName;
                        await prisma_1.prisma.receipt.update({ where: { id: receiptId }, data: { data: baseData } });
                    }
                    try {
                        const actorId = (await (0, api_1.getActorId)()) || "system";
                        await prisma_1.prisma.actionLog.create({ data: { actorId, entity: "Receipt", entityId: receiptId, action: "NORMALIZE_NAME_FALLBACK", before: before, after: { normalizedName } } });
                    }
                    catch (e) {
                        console.warn("Failed to persist receipt action log", e);
                    }
                }
            }
            catch (e) {
                console.warn("Failed to persist normalized name to receipt", e);
            }
        }
        return server_1.NextResponse.json({ normalizedName });
    }
}
