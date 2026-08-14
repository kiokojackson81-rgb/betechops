import { z } from "zod";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { createLipaPolePole, getLppAccountSummary, listSerializedLppAccounts } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

const createLppSchema = z.object({
  customerId: z.string().trim().min(1),
  productId: z.string().trim().min(1).optional().nullable(),
  quantity: z.coerce.number().int().min(1).optional(),
  agreedUnitPrice: z.union([z.coerce.number().positive(), z.string().trim().min(1)]),
  agreedTotal: z.union([z.coerce.number().positive(), z.string().trim().min(1)]).optional().nullable(),
  currency: z.string().trim().min(1).max(12).optional(),
  paymentMode: z.enum(["FLEXIBLE", "SCHEDULED"]).optional(),
  reservationMode: z.enum(["NONE", "SOFT_RESERVE", "HARD_RESERVE"]).optional(),
  expectedCompletionDate: z.string().trim().min(1).optional().nullable(),
  salespersonId: z.string().trim().min(1).optional().nullable(),
  source: z.string().trim().min(1).max(120).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  initialPayment: z.object({
    amount: z.union([z.coerce.number().positive(), z.string().trim().min(1)]),
    method: z.enum(["MPESA", "CASH", "BANK", "CARD", "OTHER"]),
    reference: z.string().trim().min(1).max(255).optional().nullable(),
    receivedById: z.string().trim().min(1).optional().nullable(),
    notes: z.string().trim().max(1000).optional().nullable(),
    receivedAt: z.string().trim().min(1).optional().nullable(),
  }).optional().nullable(),
  assignment: z.object({
    assignedToId: z.string().trim().min(1).optional().nullable(),
    assignedById: z.string().trim().min(1).optional().nullable(),
    method: z.enum(["ROUND_ROBIN", "MANUAL"]).optional(),
    eligibleRoleNames: z.array(z.string().trim().min(1)).optional(),
    eligibleCategories: z.array(z.string().trim().min(1)).optional(),
  }).optional().nullable(),
});

function mapErrorStatus(message: string) {
  if (message === "INVALID_AGREED_TOTAL" || message === "INVALID_DATE") return 400;
  if (message === "NO_ELIGIBLE_CUSTOMER_SERVICE_AGENT") return 409;
  return 500;
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = createLppSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId =
    (auth.session?.user as { id?: string } | undefined)?.id ??
    (await getActorId());

  try {
    const created = await createLipaPolePole({
      ...parsed.data,
      expectedCompletionDate: parsed.data.expectedCompletionDate ?? null,
      createdById: actorId,
      assignment: parsed.data.assignment
        ? {
            ...parsed.data.assignment,
            assignedById: parsed.data.assignment.assignedById ?? actorId,
          }
        : {
            assignedById: actorId,
          },
      initialPayment: parsed.data.initialPayment
        ? {
            ...parsed.data.initialPayment,
            receivedById: parsed.data.initialPayment.receivedById ?? actorId,
          }
        : null,
    });

    const summary = await getLppAccountSummary(created.id);
    return noStoreJson({ ok: true, account: summary.lpp, payments: summary.payments, summary: summary.summary }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create LPP account";
    return noStoreJson({ error: message }, { status: mapErrorStatus(message) });
  }
}

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim() || null;
  const status = (searchParams.get("status") || "").trim() || null;
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || "100")));
  const actorId =
    (auth.session?.user as { id?: string } | undefined)?.id ??
    (await getActorId());

  const requestedAssignedToId = (searchParams.get("assignedToId") || "").trim() || null;
  const assignedToId = auth.role === "ATTENDANT" ? actorId : requestedAssignedToId;

  const items = await listSerializedLppAccounts({
    q: q ?? undefined,
    status: status ?? undefined,
    assignedToId: assignedToId ?? undefined,
    take: limit,
  });

  return noStoreJson({ items });
}
