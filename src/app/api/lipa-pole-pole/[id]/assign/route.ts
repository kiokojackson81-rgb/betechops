import { z } from "zod";
import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { assignLipaPolePole, getLppAccountSummary } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as { params?: Promise<{ id: string }> | { id: string } }).params;
  if (maybePromise && typeof (maybePromise as Promise<{ id: string }>).then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

const assignSchema = z.object({
  assignedToId: z.string().trim().min(1).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  method: z.enum(["ROUND_ROBIN", "MANUAL"]).optional(),
  eligibleRoleNames: z.array(z.string().trim().min(1)).optional(),
  eligibleCategories: z.array(z.string().trim().min(1)).optional(),
});

function mapErrorStatus(message: string) {
  if (message === "LPP_NOT_FOUND") return 404;
  if (message === "NO_ELIGIBLE_CUSTOMER_SERVICE_AGENT") return 409;
  return 500;
}

export async function POST(req: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const body = await req.json().catch(() => ({}));
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return noStoreJson({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId =
    (auth.session?.user as { id?: string } | undefined)?.id ??
    (await getActorId());
  const { id } = await resolveParams(context);

  try {
    await assignLipaPolePole({
      lipaPolePoleId: id,
      assignedToId: parsed.data.assignedToId ?? null,
      assignedById: actorId,
      notes: parsed.data.notes ?? null,
      method: parsed.data.method,
      eligibleRoleNames: parsed.data.eligibleRoleNames,
      eligibleCategories: parsed.data.eligibleCategories,
    });

    const summary = await getLppAccountSummary(id);
    return noStoreJson({ ok: true, account: summary.lpp, summary: summary.summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to assign LPP account";
    return noStoreJson({ error: message }, { status: mapErrorStatus(message) });
  }
}
