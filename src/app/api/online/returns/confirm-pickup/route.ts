"use server";

import { NextResponse } from "next/server";
import { requireAttendant } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMarketplaceAssignmentsForUser } from "@/lib/onlineOps";

export const dynamic = "force-dynamic";

type ConfirmPayload = {
  returnId: string;
  attachmentUrl?: string;
  notes?: string;
};

export async function POST(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  let payload: ConfirmPayload | null = null;
  try {
    payload = (await req.json()) as ConfirmPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload?.returnId) {
    return NextResponse.json({ error: "returnId is required" }, { status: 400 });
  }

  const entry = await prisma.marketplaceReturn.findUnique({
    where: { id: payload.returnId },
  });

  if (!entry) {
    return NextResponse.json({ error: "Return not found" }, { status: 404 });
  }

  const { accountIds } = await getMarketplaceAssignmentsForUser(auth.user.id);
  if (!accountIds.includes(entry.accountId) && auth.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.marketplaceReturn.update({
      where: { id: entry.id },
      data: {
        status: "PICKED",
        processedById: auth.user.id,
        processedAt: new Date(),
        notes: payload?.notes ?? entry.notes,
      },
    });

    if (payload?.attachmentUrl) {
      await tx.marketplaceReturnAttachment.create({
        data: {
          returnId: entry.id,
          url: payload.attachmentUrl,
          uploadedById: auth.user.id,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
