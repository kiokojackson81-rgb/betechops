import { NextRequest, NextResponse } from "next/server";
import { sendOtpSms } from "@/lib/africasTalking";
import { createOtpCode } from "@/lib/phoneOtpAuth";
import { normalizeKenyanPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
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
  return `send-otp:${ip}:${phone}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const phone = normalizeKenyanPhone(String(body?.phone || "").trim());
  console.info("[send-otp] incoming request", {
    phone,
    hasBody: Boolean(body),
  });

  if (!phone) {
    console.warn("[send-otp] rejected invalid phone");
    return NextResponse.json({ ok: false, error: "Phone number is required." }, { status: 400 });
  }

  if (!allowRequest(getClientKey(req, phone))) {
    console.warn("[send-otp] rate limited", { phone });
    return NextResponse.json({ ok: false, error: "Too many OTP requests. Please wait before trying again." }, { status: 429 });
  }

  try {
    const { normalizedPhone, code } = await createOtpCode(phone);
    console.info("[send-otp] OTP persisted", {
      phone: normalizedPhone,
      code,
    });
    await sendOtpSms(normalizedPhone, code);
    console.info("[send-otp] OTP SMS sent successfully", {
      phone: normalizedPhone,
    });

    return NextResponse.json({
      ok: true,
      phone: normalizedPhone,
      message: `We sent a verification code to ${normalizedPhone}.`,
    });
  } catch (error) {
    console.error("[send-otp] failed", {
      phone,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to send OTP.",
      },
      { status: 400 },
    );
  }
}
