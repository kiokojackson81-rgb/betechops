import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCallFeedbackDetail } from "@/lib/callFeedback";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await auth();
  const role = String((session?.user as { role?: string } | undefined)?.role || "").toUpperCase();
  if (!session || !["ADMIN", "SUPERVISOR"].includes(role)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const id = String(params.id || "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing feedback id" }, { status: 400 });
  }

  const detail = await getCallFeedbackDetail(id);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "Feedback not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    ...detail,
  });
}
