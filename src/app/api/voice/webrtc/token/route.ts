import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildVoiceWebrtcIdentity,
  resolveVoiceViewer,
  resolveVoiceWebrtcClientName,
} from "@/lib/voiceOperations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_TOKEN_EXPIRY_SECONDS = 3600;

function isVoiceWebrtcEnabled() {
  return String(process.env.NEXT_PUBLIC_VOICE_WEBRTC_ENABLED || "").trim().toLowerCase() === "true";
}

function buildConfigDebug(input: {
  username: string;
  apiKey: string;
  phoneNumber: string;
  webRtcEnabled: boolean;
}) {
  return {
    hasUsername: Boolean(input.username),
    hasApiKey: Boolean(input.apiKey),
    hasPhoneNumber: Boolean(input.phoneNumber),
    username: input.username || null,
    phoneNumber: input.phoneNumber || null,
    webRtcEnabled: input.webRtcEnabled,
  };
}

export async function GET(request: Request) {
  try {
    const viewer = await resolveVoiceViewer();

    if (!viewer) {
      return NextResponse.json({ error: "not_authorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: viewer.targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        attendantCategory: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "voice_user_not_found" }, { status: 404 });
    }

    const username = String(process.env.AFRICASTALKING_USERNAME || "").trim();
    const apiKey = String(process.env.AFRICASTALKING_API_KEY || "").trim();
    const phoneNumber = String(process.env.AFRICASTALKING_VOICE_PHONE_NUMBER || "").trim();
    const webRtcEnabled = isVoiceWebrtcEnabled();
    const expire = DEFAULT_TOKEN_EXPIRY_SECONDS;
    const clientName = resolveVoiceWebrtcClientName({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      attendantCategory: user.attendantCategory,
      phone: user.phone,
    });
    const identity = buildVoiceWebrtcIdentity(clientName, username) ?? clientName;
    const expiresAt = new Date(Date.now() + expire * 1000).toISOString();
    const configDebug = buildConfigDebug({
      username,
      apiKey,
      phoneNumber,
      webRtcEnabled,
    });

    console.info("[voice.webrtc.token.config]", configDebug);

    if (!webRtcEnabled || !username || !apiKey || !phoneNumber) {
      return NextResponse.json(
        {
          error: "voice_webrtc_server_not_configured",
          clientName,
          identity,
          expiresAt,
          phoneNumber,
          mode: "mock" as const,
          config: configDebug,
        },
        { status: 503 },
      );
    }

    const tokenRequestPayload = {
      username,
      clientName,
      phoneNumber,
      incoming: true,
      outgoing: true,
      expire,
    };
    const tokenResponse = await fetch("https://webrtc.africastalking.com/capability-token/request", {
      method: "POST",
      headers: {
        apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tokenRequestPayload),
      cache: "no-store",
    });

    const payload = (await tokenResponse.json().catch(() => ({}))) as {
      token?: string;
      lifeTimeSec?: string | number;
      clientName?: string;
    };

    if (!tokenResponse.ok || !payload.token) {
      console.error("[voice.webrtc.token.provider_failed]", {
        status: tokenResponse.status,
        request: tokenRequestPayload,
        response: payload,
      });
      return NextResponse.json(
        {
          error: "voice_webrtc_token_failed",
          status: tokenResponse.status,
          detail: payload,
        },
        { status: 502 },
      );
    }

    const effectiveLifetime = Number(payload.lifeTimeSec || expire);
    return NextResponse.json({
      token: payload.token,
      clientName,
      identity,
      expiresAt: new Date(Date.now() + effectiveLifetime * 1000).toISOString(),
      phoneNumber,
      mode: "webrtc" as const,
    });
  } catch (error) {
    console.error("[voice.webrtc.token.failed]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "voice_webrtc_token_failed",
      },
      { status: 500 },
    );
  }
}
