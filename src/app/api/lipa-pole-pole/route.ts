import { z } from "zod";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { updateSafeCustomerProfile } from "@/lib/customerProfile";
import { createLipaPolePole, getSerializedLppAccountDetail, listSerializedLppAccounts } from "@/lib/lipaPolePoleService";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const customerDetailsSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(10).max(32),
  email: z.string().trim().email().optional().or(z.literal("")).nullable(),
  county: z.string().trim().max(120).optional().or(z.literal("")).nullable(),
  town: z.string().trim().max(120).optional().or(z.literal("")).nullable(),
  estateLandmark: z.string().trim().max(255).optional().or(z.literal("")).nullable(),
  locationNotes: z.string().trim().max(1000).optional().or(z.literal("")).nullable(),
});

const createLppSchema = z.object({
  customerId: z.string().trim().min(1).optional().nullable(),
  customer: customerDetailsSchema.optional().nullable(),
  productId: z.string().trim().min(1).optional().nullable(),
  customProductName: z.string().trim().min(1).max(1000).optional().nullable(),
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
  installmentPlan: z.object({
    frequency: z.enum(["WEEKLY", "MONTHLY"]),
    count: z.coerce.number().int().min(1).max(60),
  }).optional().nullable(),
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
}).superRefine((value, ctx) => {
  if (!value.customerId && !value.customer) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customer"],
      message: "Provide a customer ID or customer details.",
    });
  }
  if (!value.productId && !value.customProductName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customProductName"],
      message: "Select a product or enter an item description.",
    });
  }
});

function normalizeOptional(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

async function resolveCustomerId(
  input:
    | {
        customerId?: string | null;
        customer?: z.infer<typeof customerDetailsSchema> | null;
      }
    | undefined,
) {
  const directId = String(input?.customerId || "").trim();
  if (directId) return directId;

  const customer = input?.customer;
  if (!customer) {
    throw new Error("Customer details are required.");
  }

  const normalizedPhone = normalizeKenyanPhone(customer.phone);
  if (!normalizedPhone) {
    throw new Error("Enter a valid Kenyan phone number.");
  }

  const normalizedEmail = normalizeOptional(customer.email)?.toLowerCase() ?? null;

  const existingByPhone = await prisma.user.findUnique({
    where: { phone: normalizedPhone },
    select: { id: true },
  });

  const existingByEmail =
    !existingByPhone && normalizedEmail
      ? await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        })
      : null;

  const existing = existingByPhone || existingByEmail;
  if (existing) {
    await updateSafeCustomerProfile(existing.id, {
      name: customer.name,
      phone: normalizedPhone,
      whatsappNumber: normalizedPhone,
      email: normalizedEmail,
      county: normalizeOptional(customer.county),
      town: normalizeOptional(customer.town),
      estateLandmark: normalizeOptional(customer.estateLandmark),
      locationNotes: normalizeOptional(customer.locationNotes),
    });
    return existing.id;
  }

  try {
    const created = await prisma.user.create({
      data: {
        name: customer.name,
        phone: normalizedPhone,
        whatsappNumber: normalizedPhone,
        email: normalizedEmail,
        county: normalizeOptional(customer.county),
        town: normalizeOptional(customer.town),
        estateLandmark: normalizeOptional(customer.estateLandmark),
        locationNotes: normalizeOptional(customer.locationNotes),
        isActive: true,
        lastLoginMethod: "ADMIN_LPP_CREATE",
      },
      select: { id: true },
    });
    return created.id;
  } catch {
    const recoveredByPhone = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { id: true },
    });
    if (recoveredByPhone) return recoveredByPhone.id;

    if (normalizedEmail) {
      const recoveredByEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (recoveredByEmail) return recoveredByEmail.id;
    }

    throw new Error("Could not create or resolve customer.");
  }
}

function mapErrorStatus(message: string) {
  if (message === "INVALID_AGREED_TOTAL" || message === "INVALID_DATE" || message === "INVALID_PRODUCT") return 400;
  if (message === "NO_ELIGIBLE_CUSTOMER_SERVICE_AGENT") return 409;
  if (message === "Customer details are required." || message === "Enter a valid Kenyan phone number." || message === "Could not create or resolve customer.") return 400;
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
    const customerId = await resolveCustomerId(parsed.data);
    const created = await createLipaPolePole({
      ...parsed.data,
      customerId,
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

    const detail = await getSerializedLppAccountDetail(created.id);
    return noStoreJson({ ok: true, ...detail }, { status: 201 });
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
