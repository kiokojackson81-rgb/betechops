import { DocType, OrderStatus, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getShopProducts } from "@/app/shop/shopApi";
import { findOrCreateCustomerIdentityUser } from "@/lib/customerIdentity";
import { prisma } from "@/lib/prisma";
import {
  calculateAccessoriesEstimate,
  calculateInstallationFee,
  calculateTransportFee,
  inferLegacyProductCataloguePolicy,
  productCatalogueConfigurationSchema,
} from "@/lib/productCataloguePolicy";
import { buildReceiptProjectFlow } from "@/lib/receiptProjects";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  productId: z.string().trim().min(1),
  customerName: z.string().trim().min(2).max(160),
  customerPhone: z.string().trim().min(7).max(40),
  customerEmail: z.string().trim().email().max(200),
  county: z.string().trim().min(2).max(100),
  town: z.string().trim().min(2).max(120),
  exactLocation: z.string().trim().min(2).max(300),
  zone: z.enum(["ZONE_1", "ZONE_2", "ZONE_3"]),
  paymentStructure: z.enum(["FULL_UPFRONT", "DEPOSIT_30"]),
  preferredInstallationDate: z.coerce.date(),
});

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
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Complete the installation booking details.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
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
  const transport = calculateTransportFee(input.zone, policy, settings);
  const accessories = calculateAccessoriesEstimate(storefrontProduct.price, policy);
  const productAmount = Number(storefrontProduct.price || 0);
  const installationFee = Number(installation.amount || 0);
  const transportFee = Number(transport.amount || 0);
  const accessoriesFee = Number(accessories.amount || 0);
  const totalAmount = productAmount + installationFee + transportFee + accessoriesFee;
  const paymentTerm = input.paymentStructure === "DEPOSIT_30"
    ? "DEPOSIT_AND_BALANCE"
    : "FULL_BEFORE_INSTALLATION";
  const projectRef = await buildUniqueProjectRef();
  const location = [input.exactLocation, input.town, input.county].join(", ");
  const customerIdentity = await findOrCreateCustomerIdentityUser({
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    locationNotes: input.exactLocation,
  });
  const projectFlow = buildReceiptProjectFlow({
    stage: "RECEIPT_CREATED",
    paymentTerm,
    projectValue: totalAmount,
    depositPercent: input.paymentStructure === "DEPOSIT_30" ? 30 : 0,
    depositPaidAmount: 0,
    amountPaidTotal: 0,
    scheduledDate: input.preferredInstallationDate,
    postedReceiptNumber: projectRef,
    internalNotes: "Installation booked by customer from the website.",
    paymentNotes: input.paymentStructure === "DEPOSIT_30"
      ? "30% deposit required before project scheduling is confirmed."
      : "Full payment required before project scheduling is confirmed.",
  });

  const shop = await prisma.shop.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!shop) {
    return NextResponse.json({ ok: false, error: "No active Betech shop is configured." }, { status: 500 });
  }

  const receipt = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber: projectRef,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        shopId: shop.id,
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.UNPAID,
        totalAmount,
        paidAmount: 0,
        metadata: {
          customerUserId: customerIdentity.user.id,
          customerType: "project",
          deliveryAddress: location,
          bookingSource: "WEBSITE_INSTALLATION",
          county: input.county,
          town: input.town,
          exactLocation: input.exactLocation,
          zone: input.zone,
          projectFlow,
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
          customerType: "project",
          orderRef: projectRef,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail,
          deliveryAddress: location,
          paymentMethod: input.paymentStructure === "DEPOSIT_30"
            ? "30% deposit, balance after installation"
            : "Full payment before installation",
          source: "WEBSITE_INSTALLATION",
          projectFlow,
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
        },
      },
    });
  });

  return NextResponse.json({
    ok: true,
    source: "project",
    projectRef,
    receiptId: receipt.id,
    successUrl: `/project-booking-success?ref=${encodeURIComponent(projectRef)}`,
  });
}
