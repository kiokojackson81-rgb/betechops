import { z } from "zod";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { createLppPromise, getSerializedLppAccountDetail } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as { params?: Promise<{ id: string }> | { id: string } }).params;
  if (maybePromise && typeof (maybePromise as Promise<{ id: string }>).then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

const promiseSchema = z.object({
  promiseAmount: z.union([z.coerce.number().positive(), z.string().trim().min(1)]),
  promiseDate: z.string().trim().min(1),
  notes: z.string().trim().max(1000).optional().nullable(),
});

function mapErrorStatus(message: string) {
  if (["PROMISE_DATE_REQUIRED", "INVALID_PROMISE_AMOUNT", "INVALID_DATE"].includes(message)) return 400;
  if (message === "LPP_NOT_FOUND") return 404;
  return 500;
}

export async function POST(req: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = promiseSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId =
    (auth.session?.user as { id?: string } | undefined)?.id ??
    (await getActorId());
  const { id } = await resolveParams(context);

  try {
    await createLppPromise({
      lipaPolePoleId: id,
      promiseAmount: parsed.data.promiseAmount,
      promiseDate: parsed.data.promiseDate,
      notes: parsed.data.notes ?? null,
      createdById: actorId,
    });
    const detail = await getSerializedLppAccountDetail(id);
    return noStoreJson({ ok: true, ...detail }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create promise";
    return noStoreJson({ error: message }, { status: mapErrorStatus(message) });
  }
}
