import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { publishProjectNotification } from "@/services/project-notifications/project-notification.service";

const retrySchema = z.object({
  eventType: z.enum(["PROJECT_BOOKED", "PROJECT_ASSIGNED", "PROJECT_COMPLETED", "PROJECT_BOOKING_UPDATED"]),
});

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

async function resolveId(context: ParamsContext) {
  const params = await (context as { params: Promise<{ id: string }> | { id: string } }).params;
  return params.id;
}

export async function POST(req: NextRequest, context: ParamsContext) {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!guard.ok) return guard.res;

  const id = await resolveId(context);
  const body = await req.json().catch(() => ({}));
  const parsed = retrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid retry payload" }, { status: 400 });
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: { id: true, data: true },
  });
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const data =
    receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
      ? (receipt.data as Record<string, unknown>)
      : {};
  if (String(data.customerType || "").trim().toLowerCase() !== "project") {
    return NextResponse.json({ error: "This receipt is not tagged as a project receipt" }, { status: 400 });
  }

  const normalizedEventType =
    parsed.data.eventType === "PROJECT_ASSIGNED" ? "PROJECT_BOOKING_UPDATED" : parsed.data.eventType;

  const result = await publishProjectNotification({
    receiptId: id,
    event: normalizedEventType,
    triggeredByUserId: guard.session?.user?.id ?? null,
    changedFields: normalizedEventType === "PROJECT_BOOKING_UPDATED" ? ["handlerType"] : [],
  });

  return NextResponse.json({
    eventType: parsed.data.eventType,
    normalizedEventType,
    results: Object.fromEntries(result.results.map((entry) => [entry.key, entry])),
  });
}
