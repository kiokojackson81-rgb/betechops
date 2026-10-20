import { NextResponse } from "next/server";
import { setVoiceComplianceAdminDecision } from "@/lib/voiceCompliance";
import { isVoiceOperationsSchemaMissingError, resolveVoiceViewer } from "@/lib/voiceOperations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const viewer = await resolveVoiceViewer({
      impersonateId: new URL(request.url).searchParams.get("impersonateId"),
    });
    if (!viewer) return NextResponse.json({ error: "not_authorized" }, { status: 401 });
    if (!viewer.isAdmin) return NextResponse.json({ error: "admin_required" }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
      action?: string;
      reason?: string;
    };
    if (!body.userId || !["restore", "restrict"].includes(String(body.action))) {
      return NextResponse.json({ error: "invalid_compliance_decision" }, { status: 400 });
    }
    const compliance = await setVoiceComplianceAdminDecision({
      userId: body.userId,
      adminId: viewer.actorUserId,
      action: body.action as "restore" | "restrict",
      reason: body.reason,
    });
    return NextResponse.json({ ok: true, compliance });
  } catch (error) {
    console.error("[voice.compliance.failed]", error);
    if (isVoiceOperationsSchemaMissingError(error)) {
      return NextResponse.json({ error: "voice_operations_migration_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "voice_compliance_failed" }, { status: 400 });
  }
}
