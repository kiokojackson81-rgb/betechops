import { NextRequest, NextResponse } from "next/server";
import { applyReferralAttributionToUser, REFERRAL_COOKIE_NAME } from "@/lib/attribution";
import { normalizeKenyanPhone } from "@/lib/phone";
import { createVerifiedAuthToken, verifyOtpCodeForChannel } from "@/lib/phoneOtpAuth";
import { isAgentsHost } from "@/lib/agents/host";
import { isOpsHost } from "@/lib/runtimeUrls";

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 10;
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

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function getClientKey(req: NextRequest, channel: "phone" | "email", identifier: string) {
  const ip =
    String(req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "global")
      .split(",")[0]
      .trim() || "global";
  return `verify-otp:${ip}:${channel}:${identifier}`;
}

function getPreferredRedirect(req: NextRequest, rawCallbackUrl: string) {
  const callbackUrl = String(rawCallbackUrl || "").trim();
  const host = req.headers.get("host");
  if (isAgentsHost(host)) {
    if (
      callbackUrl === "/dashboard" ||
      callbackUrl === "/agents/dashboard" ||
      callbackUrl.startsWith("/agents/")
    ) {
      return callbackUrl;
    }
    return "/dashboard";
  }

  if (callbackUrl.startsWith("/")) return callbackUrl;
  if (isOpsHost(host)) return "/auth/post-login";
  return "/account";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const identifierType = body?.identifierType === "email" ? "email" : "phone";
  const rawIdentifier = String(body?.identifier || body?.phone || body?.email || "").trim();
  const email = identifierType === "email" || looksLikeEmail(rawIdentifier) ? normalizeEmail(rawIdentifier) : "";
  const phone = identifierType === "phone" ? normalizeKenyanPhone(rawIdentifier) : null;
  const code = String(body?.code || "").trim();
  const preferredRedirect = getPreferredRedirect(req, String(body?.callbackUrl || ""));

  if (!code || (identifierType === "phone" && !phone) || (identifierType === "email" && !email)) {
    return NextResponse.json(
      { ok: false, error: identifierType === "email" ? "Email address and OTP are required." : "Phone number and OTP are required." },
      { status: 400 },
    );
  }

  const rateLimitIdentifier = identifierType === "email" ? email : phone;
  if (!rateLimitIdentifier || !allowRequest(getClientKey(req, identifierType, rateLimitIdentifier))) {
    return NextResponse.json({ ok: false, error: "Too many verification attempts. Please wait and try again." }, { status: 429 });
  }

  try {
    const resolved = await verifyOtpCodeForChannel(identifierType, rateLimitIdentifier, code, preferredRedirect);
    const referralCode = req.cookies.get(REFERRAL_COOKIE_NAME)?.value || "";
    if (resolved.user.id && referralCode) {
      await applyReferralAttributionToUser(resolved.user.id, referralCode);
    }
    const verificationToken = createVerifiedAuthToken(resolved);

    return NextResponse.json({
      ok: true,
      verificationToken,
      identifierType: resolved.channel,
      identifier: resolved.identifier,
      redirectTo: resolved.redirectTo,
      requiresProfileCompletion: resolved.requiresProfileCompletion,
      user: {
        id: resolved.user.id,
        phone: resolved.user.phone,
        email: resolved.user.email,
        name: resolved.user.name,
        role: resolved.user.role,
        isAgent: Boolean(resolved.user.agentProfile),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "OTP verification failed.",
      },
      { status: 400 },
    );
  }
}
