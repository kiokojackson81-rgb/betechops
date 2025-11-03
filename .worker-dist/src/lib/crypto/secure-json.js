"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptJson = encryptJson;
exports.decryptJson = decryptJson;
exports.encryptJsonForStorage = encryptJsonForStorage;
const crypto_1 = __importDefault(require("crypto"));
const ALGO = "aes-256-gcm";
function getKey() {
    const k = process.env.SECURE_JSON_KEY;
    if (!k)
        return null;
    // allow either raw hex or passphrase - derive 32 bytes via sha256
    if (/^[0-9a-f]{64}$/i.test(k))
        return Buffer.from(k, "hex");
    return crypto_1.default.createHash("sha256").update(k).digest();
}
function encryptJson(obj) {
    const key = getKey();
    if (!key)
        throw new Error("SECURE_JSON_KEY is not configured; cannot encrypt data");
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv(ALGO, key, iv);
    const input = Buffer.from(JSON.stringify(obj), "utf8");
    const enc = Buffer.concat([cipher.update(input), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, tag, enc]).toString("base64");
    return { payload };
}
function decryptJson(payloadObj) {
    const key = getKey();
    if (!key) {
        // Missing key: do not throw during render — return undefined so callers can handle absence
        // This avoids crashing server components if the key isn't set in runtime envs.
        // Callers that require decryption should check the return value and handle gracefully.
        if (process.env.NODE_ENV !== 'production')
            console.warn('SECURE_JSON_KEY not set; decryptJson returning undefined');
        return undefined;
    }
    const buf = Buffer.from(payloadObj.payload, "base64");
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const enc = buf.slice(28);
    const decipher = crypto_1.default.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(out.toString("utf8"));
}
// Helper that returns a JSON-ready encrypted blob for storage
function encryptJsonForStorage(obj) {
    return encryptJson(obj);
}
// Do NOT log decrypted output anywhere. Use decryptJson only in server-side contexts.
