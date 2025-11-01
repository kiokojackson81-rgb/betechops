import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  const role = (session as unknown as { user?: { role?: string } } | null)?.user?.role;
  if (role !== "ADMIN") {
    throw new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
}

// DELETE /api/settings/jumia/accounts/[id]
// Safely delete a Jumia account. Will only delete if the account has zero shops.
// If the account still has shops, returns 400 advising to merge/transfer first.
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (res) {
    if (res instanceof NextResponse) return res;
    throw res;
  }

  const { params } = context;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing account id" }, { status: 400 });

  const account = await prisma.jumiaAccount.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const shopsCount = await prisma.jumiaShop.count({ where: { accountId: id } });
  if (shopsCount > 0) {
    return NextResponse.json(
      {
        error: "Account has linked shops. Transfer shops to another account before deleting.",
        shopsCount,
      },
      { status: 400 }
    );
  }

  await prisma.jumiaAccount.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
