"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAdminSummaryJob = runAdminSummaryJob;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const adminReceiptsSummary_1 = require("@/lib/adminReceiptsSummary");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const adminSummaryMessage_1 = require("@/lib/adminSummaryMessage");
const whatsapp_1 = require("@/lib/notifications/whatsapp");
const CACHE_DIR = node_path_1.default.join(process.cwd(), ".cache");
const CUTOFF_FILE = node_path_1.default.join(CACHE_DIR, "last-admin-summary.json");
const DEFAULT_ADMIN_PHONE = "254705663175";
function ensureCacheDir() {
    if (!node_fs_1.default.existsSync(CACHE_DIR)) {
        node_fs_1.default.mkdirSync(CACHE_DIR, { recursive: true });
    }
}
function readLastCutoff() {
    try {
        if (!node_fs_1.default.existsSync(CUTOFF_FILE))
            return null;
        const payload = JSON.parse(node_fs_1.default.readFileSync(CUTOFF_FILE, "utf-8"));
        return payload?.lastEnd ? new Date(payload.lastEnd) : null;
    }
    catch (error) {
        console.warn("Unable to read admin summary cutoff:", error instanceof Error ? error.message : String(error));
        return null;
    }
}
function writeCutoff(end) {
    ensureCacheDir();
    node_fs_1.default.writeFileSync(CUTOFF_FILE, JSON.stringify({ lastEnd: end.toISOString() }, null, 2), "utf-8");
}
function determineRange(now, useCutoff) {
    const tradingPeriod = (0, tradingPeriod_1.getTradingPeriodFor)(now);
    let start = tradingPeriod.start;
    if (useCutoff) {
        const lastEnd = readLastCutoff();
        if (lastEnd && lastEnd < now) {
            start = lastEnd;
        }
    }
    const end = now;
    return { start, end };
}
async function buildPayload(start, end) {
    const summary = await (0, adminReceiptsSummary_1.computeAdminReceiptSummary)({ start, end, scope: "global" });
    const payload = (0, adminSummaryMessage_1.buildAdminSummaryMessage)({ summary, start, end });
    return { summary, payload };
}
async function runAdminSummaryJob(options = {}) {
    const { now = new Date(), useCutoff = true, advanceCutoff = true, sendWhatsApp = true, adminPhone, } = options;
    const { start, end } = determineRange(now, useCutoff);
    const { summary, payload } = await buildPayload(start, end);
    if (advanceCutoff && useCutoff) {
        writeCutoff(end);
    }
    if (sendWhatsApp) {
        const phone = adminPhone ?? process.env.ADMIN_PHONE ?? DEFAULT_ADMIN_PHONE;
        if (phone && (0, whatsapp_1.hasWhatsAppConfig)()) {
            try {
                await (0, whatsapp_1.sendWhatsAppTextMessage)({ to: phone, body: payload.summaryText });
                console.log("Admin summary sent via WhatsApp to", phone);
            }
            catch (error) {
                console.error("Failed to send WhatsApp admin summary", error instanceof Error ? error.message : error);
            }
        }
        else {
            console.warn("WhatsApp configuration missing; admin summary not sent");
        }
    }
    return { summary, payload, start, end };
}
