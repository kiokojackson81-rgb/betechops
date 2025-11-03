"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_1 = require("../src/lib/prisma");
function loadSeeds(fileArg) {
    const defaultPath = path_1.default.resolve(process.cwd(), fileArg || 'shops.secrets.json');
    const fallbackPath = path_1.default.resolve(process.cwd(), 'shops.local.json');
    const file = fs_1.default.existsSync(defaultPath) ? defaultPath : fallbackPath;
    const text = fs_1.default.readFileSync(file, 'utf-8');
    const json = JSON.parse(text);
    if (Array.isArray(json))
        return json;
    if (Array.isArray(json.shops))
        return json.shops;
    throw new Error(`Invalid seed file format at ${file}: expected array or { shops: [] }`);
}
async function upsertJumiaAccount(name, clientId, refreshToken) {
    // Prefer matching by clientId; update refreshToken and label if found
    const existing = await prisma_1.prisma.jumiaAccount.findFirst({ where: { clientId } });
    if (existing) {
        await prisma_1.prisma.jumiaAccount.update({ where: { id: existing.id }, data: { label: name, refreshToken } });
        return { action: 'updated', id: existing.id };
    }
    const created = await prisma_1.prisma.jumiaAccount.create({ data: { label: name, clientId, refreshToken } });
    return { action: 'created', id: created.id };
}
async function main() {
    const fileArg = process.argv[2];
    const seeds = loadSeeds(fileArg);
    const results = [];
    for (const s of seeds) {
        if ((s.platform && s.platform.toUpperCase() !== 'JUMIA') || !s.credentials)
            continue;
        const clientId = s.credentials.clientId;
        const refreshToken = s.credentials.refreshToken;
        if (!clientId || !refreshToken) {
            console.warn(`Skipping ${s.name}: missing clientId/refreshToken`);
            continue;
        }
        const r = await upsertJumiaAccount(s.name, clientId, refreshToken);
        results.push({ name: s.name, action: r.action, id: r.id });
        console.log(`${r.action.toUpperCase()}: ${s.name} (accountId=${r.id})`);
    }
    console.log('\nJumia accounts seed complete:', results);
}
main()
    .then(() => prisma_1.prisma.$disconnect())
    .catch((e) => {
    console.error(e);
    return prisma_1.prisma.$disconnect().then(() => process.exit(1));
});
