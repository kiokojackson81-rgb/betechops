import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;
  const body = await request.json().catch(() => ({}));
  const receiptId = String(body.receiptId ?? "").trim();
  const reference = String(body.reference ?? "").trim();
  if (!receiptId) return NextResponse.json({ error: "Receipt is required." }, { status: 400 });

  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, select: { id: true, data: true } });
  const data = receipt?.data && typeof receipt.data === "object" && !Array.isArray(receipt.data) ? { ...(receipt.data as Record<string, unknown>) } : null;
  const pod = data?.podDelivery && typeof data.podDelivery === "object" && !Array.isArray(data.podDelivery) ? { ...(data.podDelivery as Record<string, unknown>) } : null;
  if (!receipt || !data || !pod) return NextResponse.json({ error: "POD receipt was not found." }, { status: 404 });
  if (String(pod.status ?? "").toLowerCase() !== "delivered") return NextResponse.json({ error: "Only delivered PODs can be reconciled as paid by Speedaf." }, { status: 400 });

  const actorId = String((auth.session?.user as { id?: string } | undefined)?.id ?? "").trim() || null;
  data.podDelivery = {
    ...pod,
    speedafSettlement: {
      status: "paid",
      settledAt: new Date().toISOString(),
      settledById: actorId,
      reference: reference || null,
      matchedBy: "manual",
    },
  };
  await prisma.receipt.update({ where: { id: receipt.id }, data: { data: data as Prisma.InputJsonValue } });
  return NextResponse.json({ ok: true });
}
