import { auth } from "@/lib/auth";
import { noStoreJson } from "@/lib/api";
import { getSerializedLppAccountDetail } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

type ParamsContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: ParamsContext) {
  const session = await auth();
  const user = session?.user as { id?: string | null } | undefined;
  if (!user?.id) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const detail = await getSerializedLppAccountDetail(id);
    if (detail.account.customerId !== user.id) {
      return noStoreJson({ error: "Forbidden" }, { status: 403 });
    }
    return noStoreJson({ ok: true, ...detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Lipa Pole Pole account.";
    return noStoreJson({ error: message }, { status: message === "LPP_NOT_FOUND" ? 404 : 500 });
  }
}
