import { NextResponse } from "next/server";
import {
  isVoiceOperationsSchemaMissingError,
  resolveVoiceViewer,
  updateVoiceAgentRoutingPreference,
  updateVoiceRoutingConfig,
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

    if (!viewer.isAdmin) {
      return NextResponse.json({ error: "admin_required" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      userId?: string | null;
      routingEnabled?: boolean | null;
      allowAfterHoursCalls?: boolean | null;
      overflowUserId?: string | null;
      overflowPhone?: string | null;
    };

    if (body.userId) {
      const preference = await updateVoiceAgentRoutingPreference({
        userId: body.userId,
        routingEnabled: body.routingEnabled,
        allowAfterHoursCalls: body.allowAfterHoursCalls,
      });
      return NextResponse.json({ ok: true, preference }, { status: 200 });
    }

    const config = await updateVoiceRoutingConfig({
      overflowUserId: body.overflowUserId,
      overflowPhone: body.overflowPhone,
    });

    return NextResponse.json(
      {
        ok: true,
        config: {
          overflowUserId: config.overflowUserId,
          overflowPhone: config.overflowPhone,
          overflowUserLabel: config.overflowUser?.name || config.overflowUser?.email || config.overflowUser?.phone || null,
          updatedAt: config.updatedAt.toISOString(),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[voice.routing.failed]", error);
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
      { error: error instanceof Error ? error.message : "voice_routing_failed" },
      { status: 400 },
    );
  }
}
