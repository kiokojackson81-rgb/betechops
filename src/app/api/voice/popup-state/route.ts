import { NextResponse } from "next/server";
import {
  isVoiceOperationsSchemaMissingError,
  resolveVoiceViewer,
  updateVoicePopupDismissal,
} from "@/lib/voiceOperations";

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
      dismissedPopupCallId?: string | null;
    };

    const presence = await updateVoicePopupDismissal({
      userId: viewer.targetUserId,
      dismissedPopupCallId: body.dismissedPopupCallId ?? null,
    });

    return NextResponse.json({
      ok: true,
      popupState: {
        userId: presence.userId,
        dismissedPopupCallId: presence.dismissedPopupCallId,
        dismissedPopupAt: presence.dismissedPopupAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[voice.popup_state.failed]", error);
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
      { error: error instanceof Error ? error.message : "voice_popup_state_failed" },
      { status: 400 },
    );
  }
}
