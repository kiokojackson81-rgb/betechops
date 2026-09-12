import { DocType, OrderStatus, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getShopProducts } from "@/app/shop/shopApi";
import { auth } from "@/lib/auth";
import { findSafeUserById } from "@/lib/customerIdentity";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  calculateAccessoriesEstimate,
  calculateInstallationFee,
  calculateTransportFee,
  inferLegacyProductCataloguePolicy,
  productCatalogueConfigurationSchema,
} from "@/lib/productCataloguePolicy";

export const dynamic = "force-dynamic";

const MINIMUM_INSTALLATION_DEPOSIT = 10_000;

const createSchema = z.object({
  productId: z.string().trim().min(1),
  customerName: z.string().trim().min(2).max(160),
  customerPhone: z.string().trim().min(7).max(40),
  customerEmail: z.string().trim().email().max(200),
  county: z.string().trim().min(2).max(100),
  town: z.string().trim().min(2).max(120),
  exactLocation: z.string().trim().min(2).max(300),
  zone: z.enum(["ZONE_1", "ZONE_2", "ZONE_3"]),
  paymentStructure: z.enum(["DEPOSIT_30", "CUSTOM_DEPOSIT"]),
  preferredDepositAmount: z.coerce.number().int().positive().optional(),
  preferredInstallationDate: z.coerce.date(),
  termsAccepted: z.literal(true),
  bookingAttemptId: z.string().trim().min(12).max(120),
});

const INSTALLATION_TERMS_URL = "https://www.betech.co.ke/p/terms";

async function buildUniqueProjectRef() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = Math.floor(10000 + Math.random() * 90000);
    const projectRef = `Betech-PROJECT-${stamp}-${suffix}`;
    const existing = await prisma.order.findUnique({ where: { orderNumber: projectRef }, select: { id: true } });
    if (!existing) return projectRef;
  }
  throw new Error("Unable to generate an installation project reference.");
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string | null } | undefined;
  if (!sessionUser?.id) {
    return NextResponse.json(
      { ok: false, error: "Sign in with OTP before booking installation.", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Complete the installation booking details.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const customerIdentity = await findSafeUserById(sessionUser.id);
  const accountPhone = normalizeKenyanPhone(customerIdentity?.phone || "");
  const submittedPhone = normalizeKenyanPhone(input.customerPhone);
  const accountEmail = String(customerIdentity?.email || "").trim().toLowerCase();
  const submittedEmail = input.customerEmail.trim().toLowerCase();
  const hasUsableEmail = Boolean(accountEmail && !accountEmail.endsWith("@placeholder.betech.local"));
  if (!customerIdentity || !accountPhone || !hasUsableEmail || !String(customerIdentity.name || "").trim()) {
    return NextResponse.json(
      { ok: false, error: "Complete your name, phone number, and email in your Betech account before booking installation." },
      { status: 409 },
    );
  }
  if (submittedPhone !== accountPhone || submittedEmail !== accountEmail) {
    return NextResponse.json(
      { ok: false, error: "The booking contact details must match your authenticated Betech account." },
      { status: 409 },
    );
  }
  const customerName = String(customerIdentity.name).trim();
  const customerPhone = accountPhone;
  const customerEmail = accountEmail;
  const termsAcceptedAt = new Date();
  const products = await getShopProducts();
  const storefrontProduct = products.find((product) => product.id === input.productId);
  if (!storefrontProduct?.opsProductId) {
    return NextResponse.json({ ok: false, error: "This product is not linked to the project catalogue." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: storefrontProduct.opsProductId } });
  if (!product?.isActive) {
    return NextResponse.json({ ok: false, error: "This product is not currently available for installation." }, { status: 400 });
  }

  const parsedPolicy = productCatalogueConfigurationSchema.safeParse(product.catalogueConfiguration);
  const policy = parsedPolicy.success
    ? parsedPolicy.data
    : inferLegacyProductCataloguePolicy(storefrontProduct);
  if (!policy) {
    return NextResponse.json({ ok: false, error: "Installation pricing is not configured for this product." }, { status: 400 });
  }

  const settings = await prisma.productCatalogueSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  const installation = calculateInstallationFee(storefrontProduct.price, policy, settings);
  if (installation.status === "ASSESSMENT") {
    return NextResponse.json(
      { ok: false, error: "This system requires a site assessment and custom installation quotation." },
      { status: 400 },
    );
  }
  const transport = calculateTransportFee(input.zone, policy);
  const accessories = calculateAccessoriesEstimate(storefrontProduct.price, policy);
  const productAmount = Number(storefrontProduct.price || 0);
  const installationFee = Number(installation.amount || 0);
  const transportFee = Number(transport.amount || 0);
  const accessoriesFee = Number(accessories.amount || 0);
  const totalAmount = productAmount + installationFee + transportFee + accessoriesFee;
  const requestedCustomDeposit = Number(input.preferredDepositAmount || 0);
  if (input.paymentStructure === "CUSTOM_DEPOSIT" && requestedCustomDeposit < MINIMUM_INSTALLATION_DEPOSIT) {
    return NextResponse.json({ ok: false, error: `Enter a preferred deposit of at least KSh ${MINIMUM_INSTALLATION_DEPOSIT.toLocaleString("en-KE")}.` }, { status: 400 });
  }
  if (input.paymentStructure === "CUSTOM_DEPOSIT" && requestedCustomDeposit > totalAmount) {
    return NextResponse.json({ ok: false, error: "The preferred deposit cannot exceed the installation booking total." }, { status: 400 });
  }
  const amountDue = input.paymentStructure === "DEPOSIT_30"
    ? Math.round(totalAmount * 0.3)
    : requestedCustomDeposit;
  const isFullSettlement = amountDue >= totalAmount;
  const paymentTerm = isFullSettlement ? "FULL_BEFORE_INSTALLATION" : "DEPOSIT_AND_BALANCE";
  const depositPercent = isFullSettlement || totalAmount <= 0
    ? 0
    : Math.round((amountDue / totalAmount) * 10_000) / 100;
  const paymentMethod = isFullSettlement
    ? "Full payment before installation"
    : input.paymentStructure === "DEPOSIT_30"
      ? "30% deposit, balance after installation"
      : `Custom deposit KSh ${amountDue.toLocaleString("en-KE")}, balance after installation`;
  // A retry from the same modal must recover the same unpaid reservation,
  // rather than putting multiple installation jobs in operations queues.
  const existingReservation = await prisma.order.findFirst({
    where: { metadata: { path: ["installationBookingAttemptId"], equals: input.bookingAttemptId } },
    select: { id: true, orderNumber: true, metadata: true, receipt: { select: { id: true } } },
  });
  if (existingReservation?.receipt) {
    const metadata = existingReservation.metadata && typeof existingReservation.metadata === "object" && !Array.isArray(existingReservation.metadata)
      ? existingReservation.metadata as Record<string, unknown> : {};
    const state = String(metadata.installationPaymentState || "AWAITING_PAYMENT");
    if (["AWAITING_PAYMENT", "PAYMENT_FAILED"].includes(state)) {
      return NextResponse.json({ ok: true, source: "project", projectRef: existingReservation.orderNumber, receiptId: existingReservation.receipt.id, amountDue: Number(metadata.installationPaymentDue || amountDue), installationPaymentState: state });
    }
  }
  const projectRef = await buildUniqueProjectRef();
  const location = [input.exactLocation, input.town, input.county].join(", ");

  const shop = await prisma.shop.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!shop) {
    return NextResponse.json({ ok: false, error: "No active Betech shop is configured." }, { status: 500 });
  }

  const receipt = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber: projectRef,
        customerName,
        customerPhone,
        customerEmail,
        shopId: shop.id,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        totalAmount,
        paidAmount: 0,
        metadata: {
          customerUserId: customerIdentity.id,
          customerType: "installation-payment-reservation",
          deliveryAddress: location,
          bookingSource: "WEBSITE_INSTALLATION",
          county: input.county,
          town: input.town,
          exactLocation: input.exactLocation,
          preferredInstallationDate: input.preferredInstallationDate.toISOString(),
          zone: input.zone,
          termsAccepted: true,
          termsAcceptedAt: termsAcceptedAt.toISOString(),
          termsUrl: INSTALLATION_TERMS_URL,
          installationBookingAttemptId: input.bookingAttemptId,
          installationPaymentState: "AWAITING_PAYMENT",
          installationPaymentDue: amountDue,
          installationBookingDeposit: amountDue,
          installationPaymentExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          installationPaymentTerm: paymentTerm,
          installationDepositPercent: depositPercent,
        },
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            sellingPrice: productAmount,
          },
        },
      },
    });

    return tx.receipt.create({
      data: {
        orderId: order.id,
        receiptNumber: projectRef,
        docType: DocType.RECEIPT,
        notes: `Preferred installation date: ${input.preferredInstallationDate.toISOString().slice(0, 10)}`,
        totals: {
          subtotal: productAmount,
          installationFee,
          transportFee,
          accessoriesFee,
          total: totalAmount,
          balance: totalAmount,
          buyingTotal: 0,
          profit: 0,
          needsPricing: true,
        },
        data: {
          customerType: "installation-payment-reservation",
          orderRef: projectRef,
          customerName,
          customerPhone,
          customerEmail,
          deliveryAddress: location,
          paymentMethod,
          source: "WEBSITE_INSTALLATION",
          customerUserId: customerIdentity.id,
          termsAccepted: true,
          termsAcceptedAt: termsAcceptedAt.toISOString(),
          termsUrl: INSTALLATION_TERMS_URL,
          installationPaymentState: "AWAITING_PAYMENT",
          installationPaymentDue: amountDue,
          installationBookingDeposit: amountDue,
          installationPaymentExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          installationPaymentTerm: paymentTerm,
          installationDepositPercent: depositPercent,
          items: [{
            productId: product.id,
            title: product.name,
            quantity: 1,
            unitPrice: productAmount,
          }],
          projectPricing: {
            productAmount,
            installationFee,
            transportFee,
            accessoriesFee,
            totalAmount,
          },
          preferredInstallationDate: input.preferredInstallationDate.toISOString(),
        },
      },
    });
  });

  return NextResponse.json({
    ok: true,
    source: "project",
    projectRef,
    receiptId: receipt.id,
    amountDue,
    installationPaymentState: "AWAITING_PAYMENT",
  });
}
