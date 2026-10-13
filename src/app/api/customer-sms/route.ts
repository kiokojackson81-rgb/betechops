import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api";
import { sendTransactionalSms } from "@/lib/africasTalking";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;
  const actorId = (auth.session?.user as { id?: string } | undefined)?.id;
  if (!actorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const phone = normalizeKenyanPhone(typeof body?.phone === "string" ? body.phone : "");
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const customerName = typeof body?.customerName === "string" ? body.customerName.trim() : "";
  const entityType = typeof body?.entityType === "string" ? body.entityType.trim().slice(0, 80) : "CUSTOMER";
  const entityId = typeof body?.entityId === "string" ? body.entityId.trim().slice(0, 191) : phone;
  const reference = typeof body?.reference === "string" ? body.reference.trim().slice(0, 191) : "";

  if (!phone) return NextResponse.json({ error: "Enter a valid Kenyan mobile number." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Enter an SMS message." }, { status: 400 });
  if (message.length > 1000) return NextResponse.json({ error: "SMS message must be 1,000 characters or less." }, { status: 400 });

  try {
    await sendTransactionalSms(phone, message);
    await prisma.actionLog.create({ data: { actorId, entity: entityType || "CUSTOMER", entityId: entityId || phone, action: "CUSTOMER_SMS_SENT", after: { customerName: customerName || null, phone, message, reference: reference || null, provider: "AFRICAS_TALKING" } } });
    return NextResponse.json({ ok: true, phone });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SMS could not be sent." }, { status: 502 });
  }
}
