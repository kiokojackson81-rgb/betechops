import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type MergePayload = {
  targetAccountId: string;
  deleteSource?: boolean; // default true
};

async function requireAdmin() {
  const session = await auth();
  const role = (session as unknown as { user?: { role?: string } } | null)?.user?.role;
  if (role !== "ADMIN") {
    throw new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
}

// POST /api/settings/jumia/accounts/[id]/merge
// Reassign all shops from [id] to targetAccountId and optionally delete the source account.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }

  const { params } = context;
  const { id: sourceAccountId } = await params;
  if (!sourceAccountId) return NextResponse.json({ error: "Missing source account id" }, { status: 400 });

  let body: MergePayload;
  try {
    body = (await request.json()) as MergePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const targetAccountId = body?.targetAccountId?.trim();
  const deleteSource = body?.deleteSource !== false; // default true

  if (!targetAccountId) {
    return NextResponse.json({ error: "targetAccountId is required" }, { status: 400 });
  }
  if (targetAccountId === sourceAccountId) {
    return NextResponse.json({ error: "targetAccountId must be different from source account id" }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    prisma.jumiaAccount.findUnique({ where: { id: sourceAccountId } }),
    prisma.jumiaAccount.findUnique({ where: { id: targetAccountId } }),
  ]);

  if (!source) return NextResponse.json({ error: "Source account not found" }, { status: 404 });
  if (!target) return NextResponse.json({ error: "Target account not found" }, { status: 404 });

  // Reassign shops in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.jumiaShop.updateMany({
      where: { accountId: sourceAccountId },
      data: { accountId: targetAccountId },
    });

    if (deleteSource) {
      // Double-check no shops remain, then delete source account
      const remaining = await tx.jumiaShop.count({ where: { accountId: sourceAccountId } });
      if (remaining === 0) {
        await tx.jumiaAccount.delete({ where: { id: sourceAccountId } });
      }
    }

    return { movedCount: moved.count };
  });

  const targetWithShops = await prisma.jumiaAccount.findUnique({
    where: { id: targetAccountId },
    include: { shops: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
  });

  return NextResponse.json({ ok: true, moved: result.movedCount, target: targetWithShops });
}
