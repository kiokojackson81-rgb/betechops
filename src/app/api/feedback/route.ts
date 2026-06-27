import { NextRequest, NextResponse } from "next/server";
import {
  callFeedbackSchema,
  isCallFeedbackSchemaMissingError,
  submitFeedbackByToken,
} from "@/lib/callFeedback";

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const requests = new Map<string, number[]>();

function allowRequest(key: string) {
  const now = Date.now();
  const recent = (requests.get(key) || []).filter((stamp) => stamp > now - WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    requests.set(key, recent);
    return false;
  }
  recent.push(now);
  requests.set(key, recent);
  return true;
}

function getClientKey(req: NextRequest) {
  const ip =
    String(req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "global")
      .split(",")[0]
      .trim() || "global";
  return `feedback:${ip}`;
}

export async function POST(req: NextRequest) {
  try {
    if (!allowRequest(getClientKey(req))) {
      return NextResponse.json({ ok: false, error: "Too many feedback submissions. Please try again later." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const parsed = callFeedbackSchema.safeParse({
      token: body?.token,
      rating: Number(body?.rating),
      contactReason: body?.contactReason,
      staffHelpful: body?.staffHelpful,
      questionsAnswered: body?.questionsAnswered,
      recommend: body?.recommend,
      comments: body?.comments,
      wantsContact: Boolean(body?.wantsContact),
      name: body?.name,
      phone: body?.phone,
      email: body?.email,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "validation_failed",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const result = await submitFeedbackByToken(parsed.data);
    if (!result.ok) {
      const status =
        result.error === "invalid_token" ? 404 : result.error === "expired_token" ? 410 : result.error === "already_submitted" ? 409 : 400;
      return NextResponse.json({ ok: false, error: result.error }, { status });
    }

    return NextResponse.json({
      ok: true,
      feedback: result.feedback,
    });
  } catch (error) {
    if (isCallFeedbackSchemaMissingError(error)) {
      return NextResponse.json({ ok: false, error: "feedback_setup_required" }, { status: 503 });
    }
    throw error;
  }
}
