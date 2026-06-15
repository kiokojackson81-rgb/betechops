import { NextRequest, NextResponse } from "next/server";
import { sendOtpSms } from "@/lib/africasTalking";
import { sendOtpVerificationEmail } from "@/lib/email";
import { createOtpCodeForChannel } from "@/lib/phoneOtpAuth";
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
  return `send-otp:${ip}:${channel}:${identifier}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const identifierType = body?.identifierType === "email" ? "email" : "phone";
  const rawIdentifier = String(body?.identifier || body?.phone || body?.email || "").trim();
  const normalizedEmail = identifierType === "email" || looksLikeEmail(rawIdentifier) ? normalizeEmail(rawIdentifier) : "";
  const phone = identifierType === "phone" ? normalizeKenyanPhone(rawIdentifier) : null;
  console.info("[send-otp] incoming request", {
    identifierType,
    identifier: identifierType === "email" ? normalizedEmail : phone,
    hasBody: Boolean(body),
  });

  if (identifierType === "email") {
    if (!normalizedEmail || !looksLikeEmail(normalizedEmail)) {
      console.warn("[send-otp] rejected invalid email");
      return NextResponse.json({ ok: false, error: "Email address is required." }, { status: 400 });
    }
  } else if (!phone) {
    console.warn("[send-otp] rejected invalid phone");
    return NextResponse.json({ ok: false, error: "Phone number is required." }, { status: 400 });
  }

  const rateLimitIdentifier = identifierType === "email" ? normalizedEmail : phone;
  if (!rateLimitIdentifier || !allowRequest(getClientKey(req, identifierType, rateLimitIdentifier))) {
    console.warn("[send-otp] rate limited", { identifierType, identifier: rateLimitIdentifier });
    return NextResponse.json({ ok: false, error: "Too many OTP requests. Please wait before trying again." }, { status: 429 });
  }

  try {
    const otpPayload = await createOtpCodeForChannel(identifierType, rawIdentifier);
    console.info("[send-otp] OTP persisted", {
      channel: identifierType,
      identifier: otpPayload.normalizedIdentifier,
      code: otpPayload.code,
    });

    if (identifierType === "email") {
      await sendOtpVerificationEmail({
        to: otpPayload.normalizedIdentifier,
        code: otpPayload.code,
      });
      console.info("[send-otp] OTP email sent successfully", {
        email: otpPayload.normalizedIdentifier,
      });

      return NextResponse.json({
        ok: true,
        identifierType: "email",
        identifier: otpPayload.normalizedIdentifier,
        email: otpPayload.normalizedIdentifier,
        message: `We sent a verification code to ${otpPayload.normalizedIdentifier}.`,
      });
    }

    await sendOtpSms(otpPayload.normalizedIdentifier, otpPayload.code);
    console.info("[send-otp] OTP SMS sent successfully", {
      phone: otpPayload.normalizedIdentifier,
    });

    return NextResponse.json({
      ok: true,
      identifierType: "phone",
      identifier: otpPayload.normalizedIdentifier,
      phone: otpPayload.normalizedIdentifier,
      message: `We sent a verification code to ${otpPayload.normalizedIdentifier}.`,
    });
  } catch (error) {
    console.error("[send-otp] failed", {
      identifierType,
      identifier: rateLimitIdentifier,
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
