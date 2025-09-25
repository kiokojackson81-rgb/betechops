import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const SCOPE = "GLOBAL";

export async function GET() {
  const c = await prisma.apiCredential.findFirst({ where: { scope: SCOPE } });
  return NextResponse.json({
    apiBase: c?.apiBase ?? process.env.JUMIA_API_BASE ?? "",
    issuer: c?.issuer ?? process.env.JUMIA_OIDC_ISSUER ?? "",
    clientId: c?.clientId ?? process.env.JUMIA_CLIENT_ID ?? "",
    refreshToken: c?.refreshToken ? "********" : "",
  });
}

export async function POST(req: Request) {
  const b = (await req.json()) as Record<string, unknown>;

  const apiBase = String(b.apiBase ?? "");
  const issuer = String(b.issuer ?? "");
  const clientId = String(b.clientId ?? "");
  const refreshTokenRaw = b.refreshToken ? String(b.refreshToken) : undefined;
  const refreshToken = refreshTokenRaw && refreshTokenRaw !== "********" ? refreshTokenRaw : undefined;

  const existing = await prisma.apiCredential.findFirst({ where: { scope: SCOPE } });
  if (existing) {
    const updateData = {
      apiBase,
      issuer,
      clientId,
      ...(refreshToken ? { refreshToken } : {}),
    };
    await prisma.apiCredential.update({ where: { id: existing.id }, data: updateData });
  } else {
    const createData = {
      scope: SCOPE,
      apiBase,
      apiKey: "",
      apiSecret: "",
      issuer,
      clientId,
      ...(refreshToken ? { refreshToken } : {}),
    };
    await prisma.apiCredential.create({ data: createData });
  }

  return NextResponse.json({ ok: true });
}
