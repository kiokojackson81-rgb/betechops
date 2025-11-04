"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
// Minimal inline encrypt helper mirroring src/lib/crypto/secure-json
function maybeEncrypt(obj) {
    const keyEnv = process.env.SECURE_JSON_KEY;
    if (!keyEnv)
        return obj;
    try {
        const key = /^[0-9a-f]{64}$/i.test(keyEnv)
            ? Buffer.from(keyEnv, "hex")
            : crypto_1.default.createHash("sha256").update(keyEnv).digest();
        const iv = crypto_1.default.randomBytes(12);
        const cipher = crypto_1.default.createCipheriv("aes-256-gcm", key, iv);
        const input = Buffer.from(JSON.stringify(obj), "utf8");
        const enc = Buffer.concat([cipher.update(input), cipher.final()]);
        const tag = cipher.getAuthTag();
        const payload = Buffer.concat([iv, tag, enc]).toString("base64");
        return { payload };
    }
    catch {
        return obj; // fallback to plaintext in dev
    }
}
function loadSeeds(fileArg) {
    const defaultPath = path_1.default.resolve(process.cwd(), fileArg || "shops.json");
    const fallbackPath = path_1.default.resolve(process.cwd(), "shops.example.json");
    const file = (0, fs_1.existsSync)(defaultPath) ? defaultPath : fallbackPath;
    const text = (0, fs_1.readFileSync)(file, "utf-8");
    const json = JSON.parse(text);
    if (Array.isArray(json))
        return json;
    if (Array.isArray(json.shops))
        return json.shops;
    throw new Error(`Invalid seed file format at ${file}: expected array or { shops: [] }`);
}
async function upsertShop(seed) {
    const name = seed.name.trim();
    const platformKey = (seed.platform || "JUMIA");
    const platform = client_1.Platform[platformKey] ?? client_1.Platform.JUMIA;
    const active = seed.active ?? true;
    const creds = seed.credentials || {};
    if (!creds || typeof creds !== "object")
        throw new Error(`Missing credentials for shop ${name}`);
    // Validate by platform
    if (platform === client_1.Platform.JUMIA) {
        if (!("tokenUrl" in creds) || !("clientId" in creds) || !("refreshToken" in creds)) {
            throw new Error(`credentials.tokenUrl, credentials.clientId, and credentials.refreshToken are required for shop ${name}`);
        }
    }
    else if (platform === client_1.Platform.KILIMALL) {
        if (!("appId" in creds) || !("appSecret" in creds)) {
            throw new Error(`credentials.appId and credentials.appSecret are required for Kilimall shop ${name}`);
        }
        // Ensure apiBase default for Kilimall if missing
        if (!("apiBase" in creds)) {
            creds.apiBase = "https://openapi.kilimall.co.ke";
        }
    }
    const credentialsEncrypted = maybeEncrypt(creds);
    const existing = await prisma.shop.findFirst({ where: { name } });
    const data = { name, platform, isActive: active, credentialsEncrypted };
    if (existing) {
        await prisma.shop.update({ where: { id: existing.id }, data });
        return { action: "updated", id: existing.id };
    }
    const created = await prisma.shop.create({ data });
    return { action: "created", id: created.id };
}
async function main() {
    const fileArg = process.argv[2];
    const seeds = loadSeeds(fileArg);
    const results = [];
    for (const s of seeds) {
        const r = await upsertShop(s);
        results.push({ name: s.name, action: r.action, id: r.id });
        console.log(`${r.action.toUpperCase()}: ${s.name} (${r.id})`);
    }
    // summary
    console.log("\nSeed complete:", results);
}
main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
    console.error(e);
    return prisma.$disconnect().then(() => process.exit(1));
});
