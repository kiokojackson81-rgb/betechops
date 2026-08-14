import { z } from "zod";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { getSerializedLppAccountDetail, releaseLppProduct } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as { params?: Promise<{ id: string }> | { id: string } }).params;
  if (maybePromise && typeof (maybePromise as Promise<{ id: string }>).then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

const releaseSchema = z.object({
  fulfillmentMethod: z.string().trim().min(2).max(120),
  collectorName: z.string().trim().max(255).optional().nullable(),
  collectorReference: z.string().trim().max(255).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  fulfilledAt: z.string().trim().min(1).optional().nullable(),
});

function mapErrorStatus(message: string) {
  if (["FULFILLMENT_METHOD_REQUIRED", "PRODUCT_NOT_ELIGIBLE_FOR_RELEASE", "INVALID_DATE"].includes(message)) return 400;
  if (message === "LPP_NOT_FOUND") return 404;
  if (message === "LPP_ALREADY_FULFILLED") return 409;
  return 500;
}

export async function POST(req: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = releaseSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId =
    (auth.session?.user as { id?: string } | undefined)?.id ??
    (await getActorId());
  const { id } = await resolveParams(context);

  try {
    await releaseLppProduct({
      lipaPolePoleId: id,
      fulfilledById: actorId,
      fulfillmentMethod: parsed.data.fulfillmentMethod,
      collectorName: parsed.data.collectorName ?? null,
      collectorReference: parsed.data.collectorReference ?? null,
      notes: parsed.data.notes ?? null,
      fulfilledAt: parsed.data.fulfilledAt ?? null,
    });

    const detail = await getSerializedLppAccountDetail(id);
    return noStoreJson({ ok: true, ...detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to release product";
    return noStoreJson({ error: message }, { status: mapErrorStatus(message) });
  }
}
