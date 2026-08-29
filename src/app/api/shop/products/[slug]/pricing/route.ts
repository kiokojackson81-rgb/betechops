import { noStoreJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  calculateInstallationFee,
  calculateAccessoriesEstimate,
  calculateTransportFee,
  productCatalogueConfigurationSchema,
} from "@/lib/productCataloguePolicy";
import { z } from "zod";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  zone: z.enum(["ZONE_1", "ZONE_2", "ZONE_3"]).optional(),
  includeInstallation: z.boolean().default(false),
});

export async function POST(req: Request, context: { params: Promise<{ slug: string }> }) {
  // This endpoint is nested below the existing [slug] product route, but receives a product ID.
  const { slug: productId } = await context.params;
  const input = requestSchema.safeParse(await req.json().catch(() => ({})));
  if (!input.success) return noStoreJson({ error: input.error.flatten() }, { status: 400 });

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sellingPrice: true,
      catalogueConfiguration: true,
      isActive: true,
    },
  });
  if (!product?.isActive) return noStoreJson({ error: "Product not found" }, { status: 404 });

  const parsedPolicy = productCatalogueConfigurationSchema.safeParse(product.catalogueConfiguration);
  if (!parsedPolicy.success) {
    return noStoreJson({
      configured: false,
      product: product.sellingPrice,
      installation: null,
      transport: null,
      estimatedTotal: product.sellingPrice,
    });
  }

  const settings = await prisma.productCatalogueSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  const installation = input.data.includeInstallation
    ? calculateInstallationFee(product.sellingPrice, parsedPolicy.data, settings)
    : null;
  const transport = input.data.zone
    ? calculateTransportFee(input.data.zone, parsedPolicy.data, settings)
    : null;
  const estimatedTotal = product.sellingPrice + (installation?.amount ?? 0) + (transport?.amount ?? 0);
  const accessories = calculateAccessoriesEstimate(product.sellingPrice, parsedPolicy.data);
  const bookingTotal = estimatedTotal + (accessories.amount ?? 0);

  return noStoreJson({
    configured: true,
    product: product.sellingPrice,
    installation,
    transport,
    estimatedTotal: bookingTotal,
    accessories,
  });
}
