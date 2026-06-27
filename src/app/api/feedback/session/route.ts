import { NextRequest, NextResponse } from "next/server";
import {
  createReplacementFeedbackSession,
  isCallFeedbackSchemaMissingError,
} from "@/lib/callFeedback";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const phone = String(body?.phone || "").trim();
    const result = await createReplacementFeedbackSession(phone);
    if (!result.ok) {
      const status = result.error === "invalid_phone" ? 400 : result.error === "no_recent_call" ? 404 : 400;
      return NextResponse.json({ ok: false, error: result.error }, { status });
    }
    return NextResponse.json({ ok: true, token: result.token, url: result.url });
  } catch (error) {
    if (isCallFeedbackSchemaMissingError(error)) {
      return NextResponse.json({ ok: false, error: "feedback_setup_required" }, { status: 503 });
    }
    throw error;
  }
}
