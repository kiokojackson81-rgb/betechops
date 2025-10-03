import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const SCOPE = "GLOBAL";

export async function GET() {
  const session = await auth();
  const role = (session as unknown as { user?: { role?: string } } | null)?.user?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const c = await prisma.apiCredential.findFirst({ where: { scope: SCOPE } });
  return NextResponse.json({
    apiBase: c?.apiBase ?? process.env.JUMIA_API_BASE ?? "",
    issuer: c?.issuer ?? process.env.JUMIA_OIDC_ISSUER ?? "",
    clientId: c?.clientId ?? process.env.JUMIA_CLIENT_ID ?? "",
    refreshToken: c?.refreshToken ? "********" : "",
    hasClientSecret: Boolean(c?.apiSecret ?? process.env.JUMIA_CLIENT_SECRET),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const role = (session as unknown as { user?: { role?: string } } | null)?.user?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const b = (await req.json()) as Record<string, unknown>;

  const apiBase = String(b.apiBase ?? "");
  const issuer = String(b.issuer ?? "");
  const clientId = String(b.clientId ?? "");
  const clientSecretRaw = b.clientSecret ? String(b.clientSecret) : undefined;
  const refreshTokenRaw = b.refreshToken ? String(b.refreshToken) : undefined;
  const refreshToken = refreshTokenRaw && refreshTokenRaw !== "********" ? refreshTokenRaw : undefined;
  const clientSecret = clientSecretRaw && clientSecretRaw !== "********" ? clientSecretRaw : undefined;

  const existing = await prisma.apiCredential.findFirst({ where: { scope: SCOPE } });
  if (existing) {
    const updateData = {
      apiBase,
      issuer,
      clientId,
      ...(refreshToken ? { refreshToken } : {}),
      ...(clientSecret ? { apiSecret: clientSecret } : {}),
    };
    await prisma.apiCredential.update({ where: { id: existing.id }, data: updateData });
  } else {
    const createData = {
      scope: SCOPE,
      apiBase,
      apiKey: "",
      apiSecret: clientSecret ?? "",
      issuer,
      clientId,
      ...(refreshToken ? { refreshToken } : {}),
    };
    await prisma.apiCredential.create({ data: createData });
  }

  return NextResponse.json({ ok: true });
}
