"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = void 0;
exports.POST = POST;
const server_1 = require("next/server");
const receiptTemplate_1 = __importDefault(require("@/app/templates/receiptTemplate"));
const branding_1 = require("@/lib/branding");
exports.runtime = "nodejs";
async function POST(req) {
    const body = await req.json().catch(() => ({}));
    const draft = body?.draft;
    if (!draft) {
        const res = server_1.NextResponse.json({ error: "Missing draft" }, { status: 400 });
        res.headers.set("Cache-Control", "no-store");
        return res;
    }
    const branding = await (0, branding_1.getBranding)();
    const html = (0, receiptTemplate_1.default)({ ...draft, branding }, { hideStamp: false, hideItemWarrantySummary: true });
    const res = server_1.NextResponse.json({ html });
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Receipt-Renderer", "template");
    res.headers.set("X-Receipt-Commit", process.env.VERCEL_GIT_COMMIT_SHA || "unknown");
    const letterhead = branding?.letterheadUrl || process.env.NEXT_PUBLIC_RECEIPT_LETTERHEAD_URL || "none";
    res.headers.set("X-Receipt-Letterhead", String(letterhead).slice(0, 120));
    return res;
}
