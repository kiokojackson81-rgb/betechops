import { getActorId, noStoreJson, requireRole, requireRoleOrBenjamin } from "@/lib/api";
import {
  deleteTestLipaPolePoleAccount,
  getSerializedLppAccountDetail,
} from "@/lib/lipaPolePoleService";

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
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;

  const actorId =
    (auth.session?.user as { id?: string } | undefined)?.id ??
    (await getActorId());
  const { id } = await resolveParams(context);

  try {
    const detail = await getSerializedLppAccountDetail(id);
    if (auth.role === "ATTENDANT" && !auth.isBenjamin && detail.account.assignedToId !== actorId) {
      return noStoreJson({ error: "Forbidden" }, { status: 403 });
    }
    return noStoreJson({ ok: true, ...detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load LPP account";
    const status = message === "LPP_NOT_FOUND" ? 404 : 500;
    return noStoreJson({ error: message }, { status });
  }
}

export async function DELETE(req: Request, context: ParamsContext) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  const actorId =
    (auth.session?.user as { id?: string } | undefined)?.id ??
    (await getActorId());
  const { id } = await resolveParams(context);
  const body = (await req.json().catch(() => null)) as
    | { confirmation?: unknown; forceTestDeletion?: unknown; reason?: unknown }
    | null;
  const confirmation =
    typeof body?.confirmation === "string" ? body.confirmation : "";

  try {
    const deleted = await deleteTestLipaPolePoleAccount({
      lipaPolePoleId: id,
      confirmation,
      actorId,
      forceTestDeletion: body?.forceTestDeletion === true,
      reason: typeof body?.reason === "string" ? body.reason : null,
    });
    return noStoreJson({ ok: true, deleted });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete LPP account";
    const status =
      message === "LPP_NOT_FOUND"
        ? 404
        : message === "LPP_DELETE_CONFIRMATION_MISMATCH"
          ? 400
          : message === "LPP_FORCE_DELETE_REASON_REQUIRED"
            ? 400
          : message === "LPP_DELETE_LINKED_TRANSACTION"
            ? 409
            : 500;
    const publicMessage =
      message === "LPP_DELETE_CONFIRMATION_MISMATCH"
        ? "The confirmation reference does not match this Lipa Pole Pole account."
        : message === "LPP_FORCE_DELETE_REASON_REQUIRED"
          ? "Forced deletion requires a reason containing the word test."
        : message === "LPP_DELETE_LINKED_TRANSACTION"
          ? "This account is linked to a receipt, project, or completed fulfillment and cannot be permanently deleted."
          : message;
    return noStoreJson({ error: publicMessage }, { status });
  }
}
