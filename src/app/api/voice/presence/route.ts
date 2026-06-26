import { NextResponse } from "next/server";
import {
  isVoiceOperationsSchemaMissingError,
  resolveVoiceViewer,
  updateVoicePresence,
} from "@/lib/voiceOperations";
import {
  clearVoiceWebrtcRegistry,
  updateVoiceWebrtcRegistry,
} from "@/lib/voiceWebrtc/registry";

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

    const body = (await request.json().catch(() => ({}))) as {
      status?: string | null;
      currentCallId?: string | null;
      webrtc?: {
        clientName?: string | null;
        identity?: string | null;
        state?: "ready" | "notready" | "offline" | "closed" | "error" | null;
      } | null;
    };

    const presence = await updateVoicePresence({
      userId: viewer.targetUserId,
      status: body.status ?? null,
      currentCallId: body.currentCallId ?? null,
    });

    if (body.webrtc?.clientName && body.webrtc?.identity && body.webrtc?.state) {
      updateVoiceWebrtcRegistry({
        userId: viewer.targetUserId,
        clientName: body.webrtc.clientName,
        identity: body.webrtc.identity,
        state: body.webrtc.state,
      });
    } else if (body.webrtc?.state && ["offline", "closed", "error", "notready"].includes(body.webrtc.state)) {
      clearVoiceWebrtcRegistry(viewer.targetUserId);
    }

    return NextResponse.json({
      ok: true,
      presence: {
        id: presence.id,
        userId: presence.userId,
        status: presence.status,
        currentCallId: presence.currentCallId,
        lastSeenAt: presence.lastSeenAt.toISOString(),
        updatedAt: presence.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[voice.presence.failed]", error);
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
      { error: error instanceof Error ? error.message : "voice_presence_failed" },
      { status: 400 },
    );
  }
}
