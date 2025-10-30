import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type AccountPayload = {
  id?: string;
  label?: string;
  clientId?: string;
  refreshToken?: string;
};

async function requireAdmin() {
  const session = await auth();
  const role = (session as unknown as { user?: { role?: string } } | null)?.user?.role;
  if (role !== "ADMIN") {
    throw new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }

  const accounts = await prisma.jumiaAccount.findMany({
    include: { shops: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  const data = accounts.map((acc) => ({
    id: acc.id,
    label: acc.label,
    clientId: acc.clientId,
    refreshToken: acc.refreshToken ? "********" : "",
    shops: acc.shops,
    createdAt: acc.createdAt,
    updatedAt: acc.updatedAt,
  }));

  return NextResponse.json({ accounts: data });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }

  try {
    const body = (await request.json()) as AccountPayload;
    const label = body.label?.trim();
    const clientId = body.clientId?.trim();
    const refreshTokenRaw = body.refreshToken?.trim();

    if (!label || !clientId) {
      return NextResponse.json({ error: "label and clientId are required" }, { status: 400 });
    }

    const refreshToken = refreshTokenRaw && refreshTokenRaw !== "********" ? refreshTokenRaw : undefined;

    let account;
    if (body.id) {
      account = await prisma.jumiaAccount.update({
        where: { id: body.id },
        data: {
          label,
          clientId,
          ...(refreshToken ? { refreshToken } : {}),
        },
        include: { shops: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
      });
    } else {
      if (!refreshToken) {
        return NextResponse.json({ error: "refreshToken is required for new accounts" }, { status: 400 });
      }
      account = await prisma.jumiaAccount.create({
        data: { label, clientId, refreshToken },
        include: { shops: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
      });
    }

    return NextResponse.json({
      ok: true,
      account: {
        id: account.id,
        label: account.label,
        clientId: account.clientId,
        refreshToken: account.refreshToken ? "********" : "",
        shops: account.shops,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
