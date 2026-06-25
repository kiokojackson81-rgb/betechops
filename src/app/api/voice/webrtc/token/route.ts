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
const PROVIDER_TIMEOUT_MS = 10000;
const CAPABILITY_TOKEN_ENDPOINT = "https://webrtc.africastalking.com/capability-token/request";

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

function buildProviderRequestDebug(input: {
  username: string;
  phoneNumber: string;
  clientName: string;
  hasApiKey: boolean;
  timeoutMs: number;
  elapsedMs?: number;
}) {
  return {
    endpoint: CAPABILITY_TOKEN_ENDPOINT,
    username: input.username,
    phoneNumber: input.phoneNumber,
    clientName: input.clientName,
    hasApiKey: input.hasApiKey,
    timeoutMs: input.timeoutMs,
    elapsedMs: input.elapsedMs ?? 0,
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
      incoming: "true",
      outgoing: "true",
      expire: String(expire),
    };
    const tokenRequestDebug = buildProviderRequestDebug({
      username,
      phoneNumber,
      clientName,
      hasApiKey: Boolean(apiKey),
      timeoutMs: PROVIDER_TIMEOUT_MS,
    });
    console.info("[voice.webrtc.token.provider_request_started]", tokenRequestDebug);

    const searchParams = new URLSearchParams(tokenRequestPayload);
    const controller = new AbortController();
    const startedAt = Date.now();
    const timeout = setTimeout(() => controller.abort("voice_webrtc_provider_timeout"), PROVIDER_TIMEOUT_MS);

    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(CAPABILITY_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: searchParams.toString(),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.message === "voice_webrtc_provider_timeout")
      ) {
        console.error(
          "[voice.webrtc.token.provider_timeout]",
          buildProviderRequestDebug({
            ...tokenRequestDebug,
            elapsedMs,
          }),
        );
        return NextResponse.json(
          {
            error: "voice_webrtc_provider_timeout",
            message: "Africa's Talking WebRTC token request timed out.",
          },
          { status: 504 },
        );
      }

      console.error("[voice.webrtc.token.provider_request_failed]", {
        ...tokenRequestDebug,
        elapsedMs,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        {
          error: "voice_webrtc_provider_request_failed",
        },
        { status: 502 },
      );
    } finally {
      clearTimeout(timeout);
    }

    const elapsedMs = Date.now() - startedAt;
    console.info(
      "[voice.webrtc.token.provider_response_received]",
      buildProviderRequestDebug({
        ...tokenRequestDebug,
        elapsedMs,
      }),
    );

    const rawBody = await tokenResponse.text().catch(() => "");
    const payload = (rawBody
      ? ((() => {
          try {
            return JSON.parse(rawBody);
          } catch {
            return {};
          }
        })())
      : {}) as {
      token?: string;
      lifeTimeSec?: string | number;
      clientName?: string;
      [key: string]: unknown;
    };

    if (!tokenResponse.ok || !payload.token) {
      console.error("[voice.webrtc.token.provider_failed]", {
        status: tokenResponse.status,
        request: tokenRequestPayload,
        elapsedMs,
        response: rawBody || payload,
      });
      return NextResponse.json(
        {
          error: "voice_webrtc_provider_rejected",
          status: tokenResponse.status,
          providerBody: rawBody || payload,
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
