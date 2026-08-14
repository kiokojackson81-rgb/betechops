import { getActorId, noStoreJson, requireRole } from "@/lib/api";
import { getSerializedLppAccountDetail } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

type ParamsContext = { params: { id: string } } | { params: Promise<{ id: string }> };

function resolveParams(context: ParamsContext): Promise<{ id: string }> {
  const maybePromise = (context as { params?: Promise<{ id: string }> | { id: string } }).params;
  if (maybePromise && typeof (maybePromise as Promise<{ id: string }>).then === "function") {
    return maybePromise as Promise<{ id: string }>;
  }
  return Promise.resolve((context as { params: { id: string } }).params);
}

export async function GET(_req: Request, context: ParamsContext) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const actorId =
    (auth.session?.user as { id?: string } | undefined)?.id ??
    (await getActorId());
  const { id } = await resolveParams(context);

  try {
    const detail = await getSerializedLppAccountDetail(id);
    if (auth.role === "ATTENDANT" && detail.account.assignedToId !== actorId) {
      return noStoreJson({ error: "Forbidden" }, { status: 403 });
    }
    return noStoreJson({ ok: true, ...detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load LPP account";
    const status = message === "LPP_NOT_FOUND" ? 404 : 500;
    return noStoreJson({ error: message }, { status });
  }
}
