import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const KEY = "commission_window";

export async function GET() {
  const row = await prisma.config.findUnique({ where: { key: KEY } });
  const json = (row?.json as Record<string, unknown>) || {};
  return NextResponse.json({
    fromDay: Number(json.fromDay ?? 24),
    toDay: Number(json.toDay ?? 24),
    adminEmails: String(json.adminEmails ?? (process.env.ADMIN_EMAILS || "")),
  });
}

export async function POST(req: Request) {
  const b = (await req.json()) as Record<string, unknown>;
  const json = {
    fromDay: Math.min(28, Math.max(1, Number(b.fromDay || 24))),
    toDay:   Math.min(28, Math.max(1, Number(b.toDay || 24))),
    adminEmails: String(b.adminEmails || ""),
  };
  await prisma.config.upsert({
    where: { key: KEY },
    update: { json },
    create: { key: KEY, json },
  });
  return NextResponse.json({ ok: true });
}
