import { NextRequest, NextResponse } from "next/server";
import { Prisma, WeeklySaleSource, WeeklySaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";

export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as { params: Promise<{ id: string }> }).params;
  if (maybePromise && typeof maybePromise.then === "function") {
    return maybePromise;
  }
  return (context as { params: { id: string } }).params;
}

export async function PATCH(req: NextRequest, context: any) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;
  const { id } = await resolveParams(context);

  const body = (await req.json().catch(() => null)) as { status?: string; amount?: number | string } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const updates: Prisma.WeeklySaleUpdateInput = {};
  if (body.amount !== undefined) {
    const nextAmount = typeof body.amount === "string" ? Number(body.amount) : body.amount;
    if (typeof nextAmount !== "number" || Number.isNaN(nextAmount)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    updates.amount = nextAmount;
  }

  if (body.status) {
    const nextStatus = body.status.toUpperCase() as WeeklySaleStatus;
    if (!Object.values(WeeklySaleStatus).includes(nextStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = nextStatus;
    const approverId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;
    // Prisma generated types expect relation updates via the `approved` relation.
    if (nextStatus === WeeklySaleStatus.APPROVED && approverId) {
      // connect the approver user
      (updates as any).approved = { connect: { id: approverId } };
    } else {
      // disconnect any existing approver when not approved
      (updates as any).approved = { disconnect: true };
    }
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const sale = await prisma.weeklySale.update({
    where: { id },
    data: updates,
    include: {
      shop: { select: { id: true, name: true, platform: true } },
      user: { select: { id: true, name: true, email: true } },
      approved: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(sale);
}

export async function DELETE(_req: NextRequest, context: any) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;
  const { id } = await resolveParams(context as ParamsContext);

  const sale = await prisma.weeklySale.findUnique({
    where: { id },
    select: { id: true, source: true, status: true },
  });
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (sale.source !== WeeklySaleSource.MANUAL || sale.status !== WeeklySaleStatus.PENDING) {
    return NextResponse.json({ error: "Only pending manual entries can be deleted" }, { status: 400 });
  }

  await prisma.weeklySale.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
