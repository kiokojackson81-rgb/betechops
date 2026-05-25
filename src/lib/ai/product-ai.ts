import { prisma } from "@/lib/prisma";
import { cleanSupplierPosterToShopAssets, type ProductImageCleanupOptions } from "@/lib/ai/image-cleaner";
import { generateEcommerceProductCopy } from "@/lib/ai/product-description";
import { extractProductFactsFromImage } from "@/lib/ai/product-ocr";

export type ProductAiAction = "clean-image" | "generate-description" | "detect-category" | "create-product-draft";

export type ProductAiDraftInput = {
  name?: string | null;
  brand?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  specifications?: string | null;
  warrantyPeriod?: string | null;
  mainImageUrl?: string | null;
  galleryImageUrls?: string[] | null;
  shopCategory?: string | null;
  shopSubcategory?: string | null;
  shopShortDescription?: string | null;
  shopSpecs?: string | null;
  shopImageUrl?: string | null;
  shopBrand?: string | null;
};

export type ProductAiPatch = {
  name?: string;
  brand?: string;
  shortDescription?: string;
  description?: string;
  specifications?: string;
  mainImageUrl?: string;
  galleryImageUrls?: string[];
  shopCategory?: string;
  shopSubcategory?: string;
  shopShortDescription?: string;
  shopSpecs?: string;
  shopImageUrl?: string;
  shopBrand?: string;
};

export type ProductAiRunResult = {
  analysis: Record<string, unknown>;
  patch: ProductAiPatch;
  outputs: {
    sourceImageUrl?: string;
    sourceImageKey?: string;
    cleanImageUrl?: string;
    transparentImageUrl?: string;
    thumbnailUrl?: string;
    bannerImageUrl?: string;
  };
};

export async function runProductAiJob(input: {
  action: ProductAiAction;
  productId?: string | null;
  actorId?: string | null;
  imageUrl?: string | null;
  draft?: ProductAiDraftInput | null;
  options?: ProductImageCleanupOptions | null;
}) {
  const prismaDb = prisma as any;
  const sourceImageUrl = input.imageUrl?.trim() || input.draft?.mainImageUrl?.trim() || input.draft?.shopImageUrl?.trim() || input.draft?.galleryImageUrls?.[0]?.trim() || "";
  const job = await prismaDb.productAiJob.create({
    data: {
      productId: input.productId || null,
      kind: input.action,
      status: "pending",
      sourceImageUrl: sourceImageUrl || null,
      createdById: input.actorId || null,
      options: input.options ?? undefined,
    },
  });

  try {
    await prismaDb.productAiJob.update({
      where: { id: job.id },
      data: { status: "processing" },
    });

    const extracted = sourceImageUrl ? await extractProductFactsFromImage(sourceImageUrl) : null;
    const generated = extracted
      ? await generateEcommerceProductCopy({
          extracted,
          currentName: input.draft?.name ?? "",
          currentBrand: input.draft?.brand ?? "",
        })
      : null;

    const patch: ProductAiPatch = {};
    const outputs: ProductAiRunResult["outputs"] = {};

    if (input.action === "clean-image" || input.action === "create-product-draft") {
      if (!sourceImageUrl) {
        throw new Error("Upload a supplier poster or main product image first");
      }

      const cleaned = await cleanSupplierPosterToShopAssets({
        imageUrl: sourceImageUrl,
        productId: input.productId || input.draft?.name || "draft",
        options: input.options ?? undefined,
      });

      outputs.sourceImageUrl = cleaned.sourceImageUrl;
      outputs.sourceImageKey = cleaned.sourceImageKey;
      outputs.cleanImageUrl = cleaned.cleanImageUrl;
      outputs.transparentImageUrl = cleaned.transparentImageUrl;
      outputs.thumbnailUrl = cleaned.thumbnailUrl;
      outputs.bannerImageUrl = cleaned.bannerImageUrl;

      patch.mainImageUrl = cleaned.cleanImageUrl;
      patch.shopImageUrl = cleaned.cleanImageUrl;
      patch.galleryImageUrls = [
        cleaned.cleanImageUrl,
        ...(cleaned.transparentImageUrl ? [cleaned.transparentImageUrl] : []),
      ];
    }

    if ((input.action === "generate-description" || input.action === "detect-category" || input.action === "create-product-draft") && extracted && generated) {
      if (input.action !== "detect-category") {
        const nextName = generated.productName || extracted.titleHint || "";
        const nextBrand = generated.brand || extracted.brand || "";
        const nextShort = generated.shortDescription || "";
        const nextDescription = generated.ecommerceDescription || "";
        const nextSpecs = generated.bulletSpecs.join("\n") || extracted.visibleSpecs.join("\n") || "";

        if (nextName) patch.name = nextName;
        if (nextBrand) {
          patch.brand = nextBrand;
          patch.shopBrand = nextBrand;
        }
        if (nextShort) {
          patch.shortDescription = nextShort;
          patch.shopShortDescription = nextShort;
        }
        if (nextDescription) patch.description = nextDescription;
        if (nextSpecs) {
          patch.specifications = nextSpecs;
          patch.shopSpecs = nextSpecs;
        }
      }

      const nextShopCategory = generated.shopCategory || extracted.shopCategory || "";
      const nextShopSubcategory = generated.shopSubcategory || extracted.shopSubcategory || "";
      if (nextShopCategory) patch.shopCategory = nextShopCategory;
      if (nextShopSubcategory) patch.shopSubcategory = nextShopSubcategory;
    }

    const analysis = {
      extracted,
      generated,
      action: input.action,
    };

    const updated = await prismaDb.productAiJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        sourceImageKey: outputs.sourceImageKey ?? null,
        analysis,
        generatedDraft: patch,
        cleanImageUrl: outputs.cleanImageUrl ?? null,
        transparentImageUrl: outputs.transparentImageUrl ?? null,
        thumbnailUrl: outputs.thumbnailUrl ?? null,
        bannerImageUrl: outputs.bannerImageUrl ?? null,
      },
    });

    return {
      job: updated,
      result: {
        analysis,
        patch,
        outputs,
      } satisfies ProductAiRunResult,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI job failed";
    const failed = await prismaDb.productAiJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: message,
      },
    });

    return {
      job: failed,
      error: message,
    };
  }
}
