import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { initiateStkPushForResource, MPESA_STK_RESOURCE_TYPES } from "@/lib/mpesa";
import { prisma } from "@/lib/prisma";
import { buildCustomerAccountIdentity } from "@/lib/shopCustomerOrders";
import { customerOwnsSiteVisit, ensureSiteVisitsSchema } from "@/lib/siteVisits";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  resourceType: z.enum(MPESA_STK_RESOURCE_TYPES),
  reference: z.string().trim().min(1).max(120),
  phoneNumber: z.string().trim().min(1).max(30).optional(),
  // This is permitted only for a flexible Lipa Pole Pole installment. It is
  // independently bounded by the agreement balance in the service.
  installmentAmount: z.coerce.number().int().positive().optional(),
  paymentAccessToken: z.string().trim().min(16).max(120).optional(),
});

async function assertCustomerOwnsPrivateResource(resourceType: "SITE_VISIT" | "LPP" | "INSTALLATION_PROJECT", reference: string) {
  const session = await auth();
  const user = session?.user as { id?: string | null; phone?: string | null; email?: string | null } | undefined;
  if (!user?.id) throw Object.assign(new Error("Sign in to pay this record."), { status: 401 });
  if (resourceType === "LPP") {
    const lpp = await prisma.lipaPolePole.findFirst({ where: { reference: { equals: reference, mode: "insensitive" } }, select: { customerId: true } });
    if (!lpp || lpp.customerId !== user.id) throw Object.assign(new Error("Payment record not found."), { status: 404 });
    return;
  }
  if (resourceType === "INSTALLATION_PROJECT") {
    const order = await prisma.order.findFirst({
      where: { orderNumber: { equals: reference, mode: "insensitive" } },
      select: { metadata: true },
    });
    const metadata = order?.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
      ? order.metadata as Record<string, unknown> : {};
    if (!order || String(metadata.customerUserId || "") !== user.id) throw Object.assign(new Error("Installation payment record not found."), { status: 404 });
    return;
  }
  const identity = buildCustomerAccountIdentity({ id: user.id, phone: user.phone || null, email: user.email || null }, null);
  await ensureSiteVisitsSchema();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "SiteVisit" WHERE LOWER("visitRef") = LOWER(${reference}) LIMIT 1
  `);
  const visit = rows[0] ? await customerOwnsSiteVisit({ visitId: rows[0].id, ...identity }) : null;
  if (!visit) throw Object.assign(new Error("Site visit not found."), { status: 404 });
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide a valid payment reference and Kenyan phone number." }, { status: 400 });
  try {
    if (parsed.data.resourceType !== "ORDER") await assertCustomerOwnsPrivateResource(parsed.data.resourceType, parsed.data.reference);
    const result = await initiateStkPushForResource(parsed.data);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initiate the M-Pesa payment.";
    const explicitStatus = Number((error as { status?: number }).status);
    const status = Number.isInteger(explicitStatus) ? explicitStatus : /not found/i.test(message) ? 404 : /number|amount|due|balance|installment/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
