import { NextResponse } from "next/server";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  addVoiceCallNote,
  isVoiceOperationsSchemaMissingError,
  reassignVoiceWork,
  resolveVoiceViewer,
} from "@/lib/voiceOperations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROVIDER_TIMEOUT_MS = 10_000;

function getTransferEndpoint(username: string) {
  return username.toLowerCase() === "sandbox"
    ? "https://voice.sandbox.africastalking.com/call/transfer"
    : "https://voice.africastalking.com/call/transfer";
}

async function transferActiveProviderCall(input: {
  sessionId: string;
  phoneNumber: string;
  holdMusicUrl: string | null;
}) {
  const username = String(process.env.AFRICASTALKING_USERNAME || "").trim();
  const apiKey = String(process.env.AFRICASTALKING_API_KEY || "").trim();
  if (!username || !apiKey) {
    throw new Error("voice_transfer_provider_not_configured");
  }

  const form = new URLSearchParams({
    username,
    sessionId: input.sessionId,
    phoneNumber: input.phoneNumber,
    // The agent is the callee on the existing two-legged customer call.
    // Replacing that leg keeps the customer connected during the handoff.
    callLeg: "callee",
  });
  if (input.holdMusicUrl) form.set("holdMusicUrl", input.holdMusicUrl);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort("voice_transfer_provider_timeout"),
    PROVIDER_TIMEOUT_MS,
  );
  try {
    const response = await fetch(getTransferEndpoint(username), {
      method: "POST",
      headers: {
        apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
      cache: "no-store",
      signal: controller.signal,
    });
    const rawBody = await response.text().catch(() => "");
    let payload: Record<string, unknown> = {};
    try {
      payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch {}
    const providerResult =
      payload.callTransferResponse && typeof payload.callTransferResponse === "object"
        ? (payload.callTransferResponse as Record<string, unknown>)
        : payload;
    const status = String(providerResult.status || "").toLowerCase();
    if (!response.ok || (status && status !== "success")) {
      console.error("[voice.transfer.provider_rejected]", {
        status: response.status,
        providerStatus: providerResult.status || null,
        errorMessage: providerResult.errorMessage || null,
      });
      throw new Error("voice_transfer_provider_rejected");
    }
    return { holdMusicApplied: Boolean(input.holdMusicUrl) };
  } finally {
    clearTimeout(timeout);
  }
}

function isActiveVoiceCallStatus(status: string | null | undefined) {
  return ["queued", "ringing", "initiated", "dialing", "in_progress", "answered", "connected", "transferred"].includes(
    String(status || "").trim().toLowerCase(),
  );
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const viewer = await resolveVoiceViewer({
      impersonateId: url.searchParams.get("impersonateId"),
    });

    if (!viewer) {
      return NextResponse.json({ ok: false, error: "not_authorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      callId?: string | null;
      targetUserId?: string | null;
      targetPhone?: string | null;
      targetLabel?: string | null;
      holdMusicUrl?: string | null;
    };

    if (!body.callId) {
      return NextResponse.json({ ok: false, error: "call_id_required" }, { status: 400 });
    }

    const call = await prisma.voiceCall.findUnique({
      where: { id: body.callId },
      select: {
        id: true,
        assignedToId: true,
        isActive: true,
        status: true,
        sessionId: true,
      },
    });

    if (!call) {
      return NextResponse.json({ ok: false, error: "voice_call_not_found" }, { status: 404 });
    }

    if (!viewer.isAdmin && call.assignedToId && call.assignedToId !== viewer.targetUserId) {
      return NextResponse.json({ ok: false, error: "not_authorized_for_call" }, { status: 403 });
    }

    if (!call.isActive && !isActiveVoiceCallStatus(call.status)) {
      return NextResponse.json({ ok: false, error: "voice_call_not_active" }, { status: 409 });
    }

    const normalizedTargetPhone = normalizeKenyanPhone(body.targetPhone || "");
    let targetUserId = String(body.targetUserId || "").trim() || null;
    let targetLabel = String(body.targetLabel || "").trim() || normalizedTargetPhone || "transfer target";

    if (!targetUserId && normalizedTargetPhone) {
      const matchedUser = await prisma.user.findFirst({
        where: {
          isActive: true,
          OR: [{ phone: normalizedTargetPhone }, { phone: String(body.targetPhone || "").trim() }],
        },
        select: {
          id: true,
          name: true,
          phone: true,
        },
      });
      if (matchedUser) {
        targetUserId = matchedUser.id;
        targetLabel = matchedUser.name || matchedUser.phone || targetLabel;
      }
    }

    if (!normalizedTargetPhone) {
      return NextResponse.json({ ok: false, error: "transfer_phone_required" }, { status: 400 });
    }

    const requestedHoldMusicUrl = String(body.holdMusicUrl || "").trim();
    const configuredHoldMusicUrl = String(
      process.env.AFRICASTALKING_TRANSFER_HOLD_MUSIC_URL || "",
    ).trim();
    const holdMusicUrl = requestedHoldMusicUrl || configuredHoldMusicUrl || null;
    if (holdMusicUrl && !/^https?:\/\//i.test(holdMusicUrl)) {
      return NextResponse.json({ ok: false, error: "invalid_hold_music_url" }, { status: 400 });
    }

    const providerTransfer = await transferActiveProviderCall({
      sessionId: call.sessionId,
      phoneNumber: normalizedTargetPhone,
      holdMusicUrl,
    });

    let reassignmentResult: Awaited<ReturnType<typeof reassignVoiceWork>> | null = null;
    if (targetUserId) {
      reassignmentResult = await reassignVoiceWork({ callId: call.id, assignedToId: targetUserId });
    }

    await addVoiceCallNote({
      voiceCallId: call.id,
      authorId: viewer.actorUserId,
      note: `Live call transferred to ${targetLabel}${providerTransfer.holdMusicApplied ? " with transfer hold audio." : "."}`,
    });

    return NextResponse.json(
      {
        ok: true,
        transfer: {
          callId: call.id,
          targetUserId,
          targetPhone: normalizedTargetPhone || null,
          targetLabel,
          reassigned: Boolean(reassignmentResult),
          holdMusicApplied: providerTransfer.holdMusicApplied,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[voice.transfer.failed]", error);
    if (isVoiceOperationsSchemaMissingError(error)) {
      return NextResponse.json(
        {
          error: "voice_operations_migration_missing",
          message: "Voice operations migration is not applied yet.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "voice_transfer_failed" },
      { status: 400 },
    );
  }
}
