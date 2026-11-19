import { NextResponse } from "next/server";
import { isVoiceOperationsSchemaMissingError, resolveVoiceViewer } from "@/lib/voiceOperations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const viewer = await resolveVoiceViewer({
      impersonateId: new URL(request.url).searchParams.get("impersonateId"),
    });
    if (!viewer) return NextResponse.json({ error: "not_authorized" }, { status: 401 });
    if (!viewer.isAdmin) return NextResponse.json({ error: "admin_required" }, { status: 403 });

    return NextResponse.json({ ok: false, error: "inbound_compliance_restrictions_disabled" }, { status: 410 });
  } catch (error) {
    console.error("[voice.compliance.failed]", error);
    if (isVoiceOperationsSchemaMissingError(error)) {
      return NextResponse.json({ error: "voice_operations_migration_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "voice_compliance_failed" }, { status: 400 });
  }
}
