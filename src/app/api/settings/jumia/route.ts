import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SCOPE = "GLOBAL";

export async function GET() {
  const found = await prisma.apiCredential.findFirst({ where: { scope: SCOPE }});
  return NextResponse.json({
    apiBase: found?.apiBase || process.env.JUMIA_API_BASE || "",
    apiKey:  found?.apiKey  || process.env.JUMIA_API_KEY  || "",
    apiSecret: found?.apiSecret || process.env.JUMIA_API_SECRET || "",
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const existing = await prisma.apiCredential.findFirst({ where: { scope: SCOPE } });
  if (existing) {
    await prisma.apiCredential.update({ where: { id: existing.id }, data: { apiBase: body.apiBase, apiKey: body.apiKey, apiSecret: body.apiSecret } });
  } else {
    await prisma.apiCredential.create({ data: { scope: SCOPE, apiBase: body.apiBase, apiKey: body.apiKey, apiSecret: body.apiSecret } });
  }
  return NextResponse.json({ ok: true });
}
