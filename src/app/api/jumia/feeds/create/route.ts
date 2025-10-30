import type { NextRequest } from "next/server";
import { noStoreJson, requireRole } from "@/lib/api";
import { postFeedProductsCreate } from "@/lib/jumia";

export async function POST(req: NextRequest) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return noStoreJson({ ok: false, error: "Payload must be an object" }, { status: 400 });
  }

  try {
    const result = await postFeedProductsCreate(payload);
    return noStoreJson({ ok: true, result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return noStoreJson({ ok: false, error: message }, { status: 502 });
  }
}
