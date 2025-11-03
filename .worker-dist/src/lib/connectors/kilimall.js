"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kmFetch = kmFetch;
exports.fetchOrders = fetchOrders;
exports.fetchPayouts = fetchPayouts;
const crypto_1 = __importDefault(require("crypto"));
const normalize_1 = require("./normalize");
function sign(appSecret, body, ts) {
    return crypto_1.default.createHash('md5').update(appSecret + body + String(ts)).digest('hex');
}
async function kmFetch(shopCreds, path, payload) {
    const ts = Date.now();
    const body = JSON.stringify(payload !== null && payload !== void 0 ? payload : {});
    const s = sign(shopCreds.appSecret, body, ts);
    const res = await fetch(`${shopCreds.apiBase}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Id': shopCreds.appId, 'X-Timestamp': String(ts), 'X-Sign': s },
        body
    });
    if (!res.ok)
        throw new Error(`Kilimall ${path} ${res.status}`);
    return res.json();
}
async function fetchOrders(shopCreds, opts) {
    // Example path; adapt to real Kilimall API
    const path = '/orders/list';
    const payload = { since: opts === null || opts === void 0 ? void 0 : opts.since };
    const j = await kmFetch(shopCreds, path, payload);
    // Map array
    const items = Array.isArray(j === null || j === void 0 ? void 0 : j.data) ? j.data : (j === null || j === void 0 ? void 0 : j.orders) || [];
    return items.map((r) => (0, normalize_1.normalizeFromKilimall)(r, shopCreds.appId));
}
async function fetchPayouts(shopCreds, opts) {
    const path = '/finance/payouts';
    const payload = { day: opts === null || opts === void 0 ? void 0 : opts.day };
    const j = await kmFetch(shopCreds, path, payload);
    return j;
}
