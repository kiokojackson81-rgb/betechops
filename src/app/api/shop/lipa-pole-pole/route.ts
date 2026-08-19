import { z } from "zod";
import { noStoreJson } from "@/lib/api";
import { auth } from "@/lib/auth";
import { updateSafeCustomerProfile } from "@/lib/customerProfile";
import { createLipaPolePole, listSerializedLppAccounts } from "@/lib/lipaPolePoleService";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { LIPA_POLE_POLE_TERMS_VERSION } from "@/lib/lipaPolePoleTerms";
import {
  getLipaPolePoleMaxInstallments,
  LIPA_POLE_POLE_MIN_DEPOSIT,
  LIPA_POLE_POLE_WEB_OWNER_EMAIL,
} from "@/lib/lipaPolePoleConfig";

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
  paymentFrequency: z.enum(["WEEKLY", "MONTHLY"]),
  installmentCount: z.coerce.number().int().min(1).max(26),
  initialPaymentAmount: z.coerce.number().positive(),
  initialPaymentMethod: z.enum(["MPESA", "CASH", "BANK", "CARD", "OTHER"]).default("MPESA"),
  initialPaymentReference: z.string().trim().max(255).optional().or(z.literal("")).nullable(),
  initialPaymentNotes: z.string().trim().max(1000).optional().or(z.literal("")).nullable(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")).nullable(),
  termsAccepted: z.literal(true),
}).superRefine((value, ctx) => {
  const max = getLipaPolePoleMaxInstallments(value.paymentFrequency);
  if (value.installmentCount > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["installmentCount"],
      message: value.paymentFrequency === "WEEKLY"
        ? "The maximum Lipa Pole Pole period is 26 weeks."
        : "The maximum Lipa Pole Pole period is 6 months.",
    });
  }
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

function calculateDueDate(frequency: "WEEKLY" | "MONTHLY", count: number) {
  const dueDate = new Date();
  if (frequency === "WEEKLY") return addDays(dueDate, count * 7);
  dueDate.setMonth(dueDate.getMonth() + count);
  return dueDate;
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
        isActive: boolean;
        status: string | null;
        ecommerceVisible: boolean;
        showInShop: boolean;
      }>>(Prisma.sql`
        SELECT
          "name",
          "sellingPrice",
          COALESCE("lipaPolePoleEnabled", false) AS "lipaPolePoleEnabled",
          "lipaPolePoleMinDeposit",
          "lipaPolePoleMaxDays",
          "lipaPolePoleDefaultDays",
          "lipaPolePoleTerms",
          COALESCE("isActive", true) AS "isActive",
          "status",
          COALESCE("ecommerceVisible", false) AS "ecommerceVisible",
          COALESCE("showInShop", false) AS "showInShop"
        FROM "Product"
        WHERE "id" = ${product.id}
        LIMIT 1
      `)
    : [];

  const [configuredEligibility] = await prisma.$queryRaw<Array<{ configured: boolean }>>(Prisma.sql`
    SELECT EXISTS(
      SELECT 1
      FROM "Product"
      WHERE "lipaPolePoleEnabled" = true
    ) AS "configured"
  `);
  const fallbackEligible = Boolean(
    productConfig &&
    !configuredEligibility?.configured &&
    productConfig.isActive &&
    (productConfig.status == null || productConfig.status === "ACTIVE") &&
    (productConfig.ecommerceVisible || productConfig.showInShop) &&
    Number(productConfig.sellingPrice) >= LIPA_POLE_POLE_MIN_DEPOSIT,
  );

  if (!productConfig?.lipaPolePoleEnabled && !fallbackEligible) {
    return noStoreJson({ error: "Lipa Pole Pole is not enabled for this product." }, { status: 409 });
  }

  const dueDate = calculateDueDate(payload.paymentFrequency, payload.installmentCount);
  const minDeposit = Number(productConfig.lipaPolePoleMinDeposit || LIPA_POLE_POLE_MIN_DEPOSIT);
  if (payload.initialPaymentAmount < minDeposit) {
    return noStoreJson(
      { error: `Minimum deposit for this product is KES ${Math.round(minDeposit).toLocaleString("en-KE")}.` },
      { status: 400 },
    );
  }
  const agreedTotal = Number(productConfig.sellingPrice) * payload.quantity;
  if (payload.initialPaymentAmount > agreedTotal) {
    return noStoreJson({ error: "Initial payment cannot exceed the agreed product price." }, { status: 400 });
  }
  const initialPaymentReference = normalizeOptional(payload.initialPaymentReference);

  const webOwner = await prisma.user.findUnique({
    where: { email: LIPA_POLE_POLE_WEB_OWNER_EMAIL },
    select: { id: true, isActive: true },
  });
  if (!webOwner?.isActive) {
    return noStoreJson(
      { error: "Lipa Pole Pole online booking is temporarily unavailable. Please contact our team for assistance." },
      { status: 409 },
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
      customProductName: productConfig.name,
      quantity: payload.quantity,
      agreedUnitPrice: productConfig.sellingPrice,
      currency: "KES",
      expectedCompletionDate: dueDate,
      salespersonId: webOwner.id,
      paymentMode: "SCHEDULED",
      reservationMode: "SOFT_RESERVE",
      source: "SHOP_SELF_SERVICE",
      notes: normalizeOptional(payload.notes) || productConfig.lipaPolePoleTerms || null,
      termsAcceptedAt: new Date(),
      termsVersion: LIPA_POLE_POLE_TERMS_VERSION,
      createdById: user.id,
      installmentPlan: {
        frequency: payload.paymentFrequency,
        count: payload.installmentCount,
      },
      assignment: {
        assignedToId: webOwner.id,
        assignedById: user.id,
        method: "MANUAL",
      },
      initialPayment: initialPaymentReference
        ? {
            amount: payload.initialPaymentAmount,
            method: payload.initialPaymentMethod,
            reference: initialPaymentReference,
            notes: normalizeOptional(payload.initialPaymentNotes) || "Customer portal deposit.",
            receivedById: null,
            status: "PENDING",
          }
        : null,
    });

    return noStoreJson({ ok: true, id: created.id, reference: created.reference }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start Lipa Pole Pole.";
    const status =
      message === "NO_ELIGIBLE_CUSTOMER_SERVICE_AGENT"
        ? 409
        : ["INVALID_DATE", "INVALID_AGREED_TOTAL", "DUPLICATE_PAYMENT_REFERENCE", "LPP_INSTALLMENT_PERIOD_EXCEEDED"].includes(message)
          ? 400
          : 500;
    return noStoreJson({
      error: message === "DUPLICATE_PAYMENT_REFERENCE"
        ? "This M-Pesa transaction code has already been submitted. Please check the code and try again."
        : message,
    }, { status });
  }
}
