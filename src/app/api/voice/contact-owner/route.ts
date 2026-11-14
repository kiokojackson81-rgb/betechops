import { NextResponse } from "next/server";
import {
  claimVoiceCustomerContact,
  isVoiceOperationsSchemaMissingError,
  resolveVoiceViewer,
} from "@/lib/voiceOperations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const viewer = await resolveVoiceViewer({
      impersonateId: url.searchParams.get("impersonateId"),
    });
    if (!viewer) {
      return NextResponse.json({ error: "not_authorized" }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as { phone?: string };
    const result = await claimVoiceCustomerContact({ viewer, phone: body.phone || "" });
    return NextResponse.json({ ok: result.status !== "owned_by_another", result });
  } catch (error) {
    if (isVoiceOperationsSchemaMissingError(error)) {
      return NextResponse.json({ error: "voice_operations_migration_missing" }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "contact_claim_failed" },
      { status: 400 },
    );
  }
}
