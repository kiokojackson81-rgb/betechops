import { z } from "zod";
import { noStoreJson } from "@/lib/api";
import { auth } from "@/lib/auth";
import { updateSafeCustomerProfile } from "@/lib/customerProfile";
import { createLipaPolePole, listSerializedLppAccounts } from "@/lib/lipaPolePoleService";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const createShopLppSchema = z.object({
  opsProductId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  customerName: z.string().trim().min(2).max(160),
  customerPhone: z.string().trim().min(10).max(32),
  customerEmail: z.string().trim().email().optional().or(z.literal("")).nullable(),
  county: z.string().trim().max(120).optional().or(z.literal("")).nullable(),
  town: z.string().trim().max(120).optional().or(z.literal("")).nullable(),
  estateLandmark: z.string().trim().max(255).optional().or(z.literal("")).nullable(),
  locationNotes: z.string().trim().max(1000).optional().or(z.literal("")).nullable(),
  expectedCompletionDate: z.string().trim().optional().nullable(),
  initialPaymentAmount: z.coerce.number().positive(),
  initialPaymentMethod: z.enum(["MPESA", "CASH", "BANK", "CARD", "OTHER"]).default("MPESA"),
  initialPaymentReference: z.string().trim().max(255).optional().or(z.literal("")).nullable(),
  initialPaymentNotes: z.string().trim().max(1000).optional().or(z.literal("")).nullable(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")).nullable(),
});

function normalizeOptional(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDueDate(input: string | null | undefined, defaultDays: number) {
  if (!input) return addDays(new Date(), defaultDays);
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("INVALID_DATE");
  }
  return parsed;
}

function diffDays(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string | null } | undefined;
  if (!user?.id) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await listSerializedLppAccounts({
    customerId: user.id,
    take: 20,
  });

  return noStoreJson({ items });
}

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { id?: string | null } | undefined;
  if (!user?.id) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createShopLppSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const normalizedPhone = normalizeKenyanPhone(payload.customerPhone);
  if (!normalizedPhone) {
    return noStoreJson({ error: "Enter a valid Kenyan phone number." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: payload.opsProductId },
    select: { id: true },
  });

  if (!product) {
    return noStoreJson({ error: "Product not found." }, { status: 404 });
  }
  const [productConfig] = product
    ? await prisma.$queryRaw<Array<{
        name: string;
        sellingPrice: Prisma.Decimal;
        lipaPolePoleEnabled: boolean;
        lipaPolePoleMinDeposit: Prisma.Decimal | null;
        lipaPolePoleMaxDays: number | null;
        lipaPolePoleDefaultDays: number | null;
        lipaPolePoleTerms: string | null;
      }>>(Prisma.sql`
        SELECT
          "name",
          "sellingPrice",
          COALESCE("lipaPolePoleEnabled", false) AS "lipaPolePoleEnabled",
          "lipaPolePoleMinDeposit",
          "lipaPolePoleMaxDays",
          "lipaPolePoleDefaultDays",
          "lipaPolePoleTerms"
        FROM "Product"
        WHERE "id" = ${product.id}
        LIMIT 1
      `)
    : [];

  if (!productConfig?.lipaPolePoleEnabled) {
    return noStoreJson({ error: "Lipa Pole Pole is not enabled for this product." }, { status: 409 });
  }

  const defaultDays = Math.max(1, Number(productConfig.lipaPolePoleDefaultDays || 30));
  const dueDate = parseDueDate(payload.expectedCompletionDate, defaultDays);
  const maxDays = Number(productConfig.lipaPolePoleMaxDays || 0);
  if (maxDays > 0 && diffDays(new Date(), dueDate) > maxDays) {
    return noStoreJson(
      { error: `Completion date cannot exceed ${maxDays} days for this product.` },
      { status: 400 },
    );
  }

  const minDeposit = Number(productConfig.lipaPolePoleMinDeposit || 0);
  if (payload.initialPaymentAmount < minDeposit) {
    return noStoreJson(
      { error: `Minimum deposit for this product is KES ${Math.round(minDeposit).toLocaleString("en-KE")}.` },
      { status: 400 },
    );
  }

  await updateSafeCustomerProfile(user.id, {
    name: payload.customerName,
    phone: normalizedPhone,
    whatsappNumber: normalizedPhone,
    email: normalizeOptional(payload.customerEmail),
    county: normalizeOptional(payload.county),
    town: normalizeOptional(payload.town),
    estateLandmark: normalizeOptional(payload.estateLandmark),
    locationNotes: normalizeOptional(payload.locationNotes),
  });

  try {
    const created = await createLipaPolePole({
      customerId: user.id,
      productId: product.id,
      quantity: payload.quantity,
      agreedUnitPrice: productConfig.sellingPrice,
      currency: "KES",
      expectedCompletionDate: dueDate,
      paymentMode: "FLEXIBLE",
      reservationMode: "SOFT_RESERVE",
      source: "SHOP_SELF_SERVICE",
      notes: normalizeOptional(payload.notes) || productConfig.lipaPolePoleTerms || null,
      createdById: user.id,
      assignment: {
        assignedById: user.id,
      },
      initialPayment: {
        amount: payload.initialPaymentAmount,
        method: payload.initialPaymentMethod,
        reference: normalizeOptional(payload.initialPaymentReference),
        notes: normalizeOptional(payload.initialPaymentNotes) || "Customer portal deposit.",
        receivedById: null,
      },
    });

    return noStoreJson({ ok: true, id: created.id, reference: created.reference }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start Lipa Pole Pole.";
    const status =
      message === "NO_ELIGIBLE_CUSTOMER_SERVICE_AGENT"
        ? 409
        : message === "INVALID_DATE" || message === "INVALID_AGREED_TOTAL"
          ? 400
          : 500;
    return noStoreJson({ error: message }, { status });
  }
}
