import { NextRequest, NextResponse } from "next/server";
import { callFeedbackSchema, isCallFeedbackSchemaMissingError, normalizeFeedbackPhone } from "@/lib/callFeedback";
import { prisma } from "@/lib/prisma";

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
      callId: body?.callId,
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

    const input = parsed.data;
    const feedback = await prisma.callFeedback.create({
      data: {
        rating: input.rating,
        contactReason: input.contactReason,
        staffHelpful: input.staffHelpful,
        questionsAnswered: input.questionsAnswered,
        recommend: input.recommend,
        comments: input.comments || null,
        wantsContact: input.wantsContact,
        name: input.name || null,
        phone: normalizeFeedbackPhone(input.phone) || null,
        email: input.email || null,
        callId: input.callId || null,
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      feedback,
    });
  } catch (error) {
    if (isCallFeedbackSchemaMissingError(error)) {
      return NextResponse.json(
        {
          ok: false,
          error: "feedback_setup_required",
        },
        { status: 503 },
      );
    }
    throw error;
  }
}
