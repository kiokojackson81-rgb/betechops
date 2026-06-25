import { NextResponse } from "next/server";
import { resolveVoiceViewer, updateVoicePresence } from "@/lib/voiceOperations";

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
    };

    const presence = await updateVoicePresence({
      userId: viewer.targetUserId,
      status: body.status || "",
      currentCallId: body.currentCallId ?? null,
    });

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "voice_presence_failed" },
      { status: 400 },
    );
  }
}

