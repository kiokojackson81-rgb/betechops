"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("@/lib/prisma");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
/**
 * POST /api/debug/post-deploy-patch
 * Secure, idempotent runner for SQL files in prisma/ named post_deploy_patch_*.sql
 * Security: requires header X-Patch-Secret to match env PATCH_SECRET.
 * Each file is split on ';' and executed sequentially. Non-fatal errors are collected.
 */
async function POST(req) {
    const secretHdr = req.headers.get("x-patch-secret") || "";
    const secretEnv = process.env.PATCH_SECRET || "";
    if (!secretEnv || secretHdr !== secretEnv) {
        return server_1.NextResponse.json({ ok: false, error: "Unauthorized: missing or invalid patch secret" }, { status: 401 });
    }
    const prismaDir = path_1.default.join(process.cwd(), "prisma");
    let files = [];
    try {
        const all = await fs_1.promises.readdir(prismaDir);
        // Restrict to a safe allowlist to avoid executing obsolete patches
        const allowlist = new Set([
            "post_deploy_patch_fix_public_platform_enum.sql",
            "post_deploy_patch_create_shop.sql",
        ]);
        files = all
            .filter((f) => /^post_deploy_patch_.*\.sql$/i.test(f))
            .filter((f) => allowlist.has(f))
            .sort();
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ ok: false, error: `Failed to read prisma dir: ${msg}` }, { status: 500 });
    }
    const results = [];
    for (const f of files) {
        const p = path_1.default.join(prismaDir, f);
        const sql = await fs_1.promises.readFile(p, "utf8").catch(() => "");
        if (!sql.trim()) {
            results.push({ file: f, ok: true, applied: 0 });
            continue;
        }
        // naive split on ';' and execute non-empty statements
        const stmts = sql
            .split(/;\s*\n/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        const errs = [];
        let applied = 0;
        for (const s of stmts) {
            try {
                // Note: using unsafe because statements may have DDL
                await prisma_1.prisma.$executeRawUnsafe(s);
                applied += 1;
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                errs.push(msg);
            }
        }
        results.push({ file: f, ok: errs.length === 0, applied, errors: errs.length ? errs : undefined });
    }
    return server_1.NextResponse.json({ ok: true, count: results.length, results, timestamp: new Date().toISOString() });
}
async function GET() {
    // List available patch files so operators can inspect before applying
    const prismaDir = path_1.default.join(process.cwd(), "prisma");
    try {
        const all = await fs_1.promises.readdir(prismaDir);
        const allowlist = new Set([
            "post_deploy_patch_fix_public_platform_enum.sql",
            "post_deploy_patch_create_shop.sql",
        ]);
        const files = all
            .filter((f) => /^post_deploy_patch_.*\.sql$/i.test(f))
            .filter((f) => allowlist.has(f))
            .sort();
        return server_1.NextResponse.json({ ok: true, files, timestamp: new Date().toISOString() });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return server_1.NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
