import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createOrUpdateMissedVoiceLead,
  createVoiceEventFromPayload,
  ensureVoiceLeadForCaller,
  upsertVoiceCallFromPayload,
} from "@/lib/voice";
import { maybeSendCallFeedbackSms } from "@/lib/feedbackSms";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      sessionId?: string;
      phone?: string;
      status?: string;
      eventType?: string;
      startedAt?: string | null;
      endedAt?: string | null;
      durationInSeconds?: number | null;
      recordingUrl?: string | null;
      notes?: string | null;
    };

    const sessionId = String(body.sessionId || "").trim();
    const phone = String(body.phone || "").trim();
    const status = String(body.status || "").trim().toLowerCase() || "dialing";

    if (!sessionId || !phone) {
      return NextResponse.json({ ok: false, error: "missing_session_id_or_phone" }, { status: 400 });
    }

    const payload: Record<string, string> = {
      sessionId,
      direction: "OUTBOUND",
      callerNumber: phone,
      destinationNumber: phone,
      status,
      eventType: String(body.eventType || status || "outbound").trim(),
    };
    if (body.startedAt) payload.startTime = body.startedAt;
    if (body.endedAt) payload.endTime = body.endedAt;
    if (body.durationInSeconds != null) payload.durationInSeconds = String(body.durationInSeconds);
    if (body.recordingUrl) payload.recordingUrl = body.recordingUrl;
    if (body.notes) payload.notes = body.notes;

    const sessionUser = session.user as { id?: string | null; email?: string | null; name?: string | null };

    const voiceCall = await upsertVoiceCallFromPayload(payload, {
      assignedToId: sessionUser.id ?? null,
      routedTo: sessionUser.email ?? sessionUser.name ?? null,
      routeType: "WEBRTC_OUTBOUND",
    });

    await createVoiceEventFromPayload(payload, voiceCall.id);
    await ensureVoiceLeadForCaller({
      callerNumber: voiceCall.callerNumber,
      startedAt: voiceCall.startedAt,
      assignedToId: voiceCall.assignedToId,
      customerId: voiceCall.customerId,
    });
    await createOrUpdateMissedVoiceLead({
      callerNumber: voiceCall.callerNumber,
      status: voiceCall.status,
      startedAt: voiceCall.startedAt,
      assignedToId: voiceCall.assignedToId,
    });
    await maybeSendCallFeedbackSms(voiceCall).catch((smsError) => {
      console.warn("[voice.outbound.feedback_sms_skipped]", smsError instanceof Error ? smsError.message : smsError);
    });

    return NextResponse.json({
      ok: true,
      callId: voiceCall.id,
      sessionId: voiceCall.sessionId,
      status: voiceCall.status,
    });
  } catch (error) {
    console.error("[voice.outbound.failed]", error);
    return NextResponse.json({ ok: false, error: "voice_outbound_failed" }, { status: 500 });
  }
}
