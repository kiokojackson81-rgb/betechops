import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCallFeedbackDetail, isCallFeedbackSchemaMissingError } from "@/lib/callFeedback";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
    const role = String((session?.user as { role?: string } | undefined)?.role || "").toUpperCase();
    if (!session || !userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const id = String(params.id || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing feedback id" }, { status: 400 });
    }

    const detail = await getCallFeedbackDetail(id, {
      agentId: ["ADMIN", "SUPERVISOR"].includes(role) ? null : userId,
    });
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Feedback not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      ...detail,
    });
  } catch (error) {
    if (isCallFeedbackSchemaMissingError(error)) {
      return NextResponse.json({ ok: false, error: "feedback_setup_required" }, { status: 503 });
    }
    throw error;
  }
}
