import { NextRequest } from "next/server";
import { z } from "zod";
import { getActorId, noStoreJson, requireRoleOrBrendah } from "@/lib/api";
import { runProductAiJob } from "@/lib/ai/product-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum(["clean-image", "generate-description", "detect-category", "create-product-draft"]),
  productId: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  options: z.object({
    transparentBackground: z.boolean().optional(),
    removeAllText: z.boolean().optional(),
    keepSupplierLogo: z.boolean().optional(),
    generateBanner: z.boolean().optional(),
  }).optional().nullable(),
  draft: z.object({
    name: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    shortDescription: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    specifications: z.string().optional().nullable(),
    warrantyPeriod: z.string().optional().nullable(),
    mainImageUrl: z.string().optional().nullable(),
    galleryImageUrls: z.array(z.string()).optional().nullable(),
    shopCategory: z.string().optional().nullable(),
    shopSubcategory: z.string().optional().nullable(),
    shopShortDescription: z.string().optional().nullable(),
    shopSpecs: z.string().optional().nullable(),
    shopImageUrl: z.string().optional().nullable(),
    shopBrand: z.string().optional().nullable(),
  }).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBrendah(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  try {
    const body = bodySchema.parse(await req.json());
    const actorId = await getActorId();
    const result = await runProductAiJob({
      action: body.action,
      productId: body.productId ?? null,
      imageUrl: body.imageUrl ?? null,
      draft: body.draft ?? null,
      options: body.options ?? null,
      actorId,
    });

    if ("error" in result) {
      return noStoreJson({ error: result.error, job: result.job }, { status: 500 });
    }

    return noStoreJson({
      job: result.job,
      result: result.result,
    });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : "Invalid AI request" },
      { status: 400 },
    );
  }
}
