import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";

/**
 * POST /api/debug/post-deploy-patch
 * Secure, idempotent runner for SQL files in prisma/ named post_deploy_patch_*.sql
 * Security: requires header X-Patch-Secret to match env PATCH_SECRET.
 * Each file is split on ';' and executed sequentially. Non-fatal errors are collected.
 */
export async function POST(req: NextRequest) {
  const secretHdr = req.headers.get("x-patch-secret") || "";
  const secretEnv = process.env.PATCH_SECRET || "";
  if (!secretEnv || secretHdr !== secretEnv) {
    return NextResponse.json({ ok: false, error: "Unauthorized: missing or invalid patch secret" }, { status: 401 });
  }

  const prismaDir = path.join(process.cwd(), "prisma");
  let files: string[] = [];
  try {
    const all = await fs.readdir(prismaDir);
    files = all.filter((f) => /^post_deploy_patch_.*\.sql$/i.test(f)).sort();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: `Failed to read prisma dir: ${msg}` }, { status: 500 });
  }

  const results: Array<{ file: string; ok: boolean; applied: number; errors?: string[] }> = [];
  for (const f of files) {
    const p = path.join(prismaDir, f);
    const sql = await fs.readFile(p, "utf8").catch(() => "");
    if (!sql.trim()) {
      results.push({ file: f, ok: true, applied: 0 });
      continue;
    }
    // naive split on ';' and execute non-empty statements
    const stmts = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const errs: string[] = [];
    let applied = 0;
    for (const s of stmts) {
      try {
        // Note: using unsafe because statements may have DDL
        await prisma.$executeRawUnsafe(s);
        applied += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errs.push(msg);
      }
    }
    results.push({ file: f, ok: errs.length === 0, applied, errors: errs.length ? errs : undefined });
  }

  return NextResponse.json({ ok: true, count: results.length, results, timestamp: new Date().toISOString() });
}

export async function GET() {
  // List available patch files so operators can inspect before applying
  const prismaDir = path.join(process.cwd(), "prisma");
  try {
    const all = await fs.readdir(prismaDir);
    const files = all.filter((f) => /^post_deploy_patch_.*\.sql$/i.test(f)).sort();
    return NextResponse.json({ ok: true, files, timestamp: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
