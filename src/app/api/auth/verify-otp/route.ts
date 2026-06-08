import { NextRequest, NextResponse } from "next/server";
import { normalizeKenyanPhone } from "@/lib/phone";
import { createVerifiedPhoneToken, verifyOtpCode } from "@/lib/phoneOtpAuth";

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

function getClientKey(req: NextRequest, phone: string) {
  const ip =
    String(req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "global")
      .split(",")[0]
      .trim() || "global";
  return `verify-otp:${ip}:${phone}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = normalizeKenyanPhone(String(body?.phone || "").trim());
  const code = String(body?.code || "").trim();

  if (!phone || !code) {
    return NextResponse.json({ ok: false, error: "Phone number and OTP are required." }, { status: 400 });
  }

  if (!allowRequest(getClientKey(req, phone))) {
    return NextResponse.json({ ok: false, error: "Too many verification attempts. Please wait and try again." }, { status: 429 });
  }

  try {
    const resolved = await verifyOtpCode(phone, code);
    const verificationToken = createVerifiedPhoneToken(resolved);

    return NextResponse.json({
      ok: true,
      verificationToken,
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
