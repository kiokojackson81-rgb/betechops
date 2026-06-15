import { NextResponse } from "next/server";
import { findPhoneAuthUserByEmail, findPhoneAuthUserByPhone } from "@/lib/phoneOtpAuth";
import { normalizeKenyanPhone } from "@/lib/phone";

function maskPhone(phone: string) {
  if (!phone) return "";
  return `${phone.slice(0, 7)}***${phone.slice(-2)}`;
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const identifier = String(body?.identifier || "").trim();

    if (!identifier) {
      return NextResponse.json({ ok: false, error: "Enter your email address or mobile number." }, { status: 400 });
    }

    if (looksLikeEmail(identifier)) {
      const result = await findPhoneAuthUserByEmail(identifier);
      if (result?.user && !result.user.isActive) {
        return NextResponse.json({ ok: false, error: "This account is inactive. Please contact Betech support." }, { status: 403 });
      }

      return NextResponse.json({
        ok: true,
        method: "email",
        identifierType: "email",
        identifier: result?.email || identifier.trim().toLowerCase(),
        account: result?.user
          ? {
              name: result.user.name,
              email: result.user.email,
              phone: result.user.phone,
            }
          : null,
        message: result?.user
          ? `We found your account. Continue with an email OTP sent to ${result.email}.`
          : `Continue with an email OTP sent to ${identifier.trim().toLowerCase()}. We will connect or create your customer account after verification.`,
      });
    }

    const normalizedPhone = normalizeKenyanPhone(identifier);
    if (!normalizedPhone) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid email address or Kenyan phone number like 0712345678." },
        { status: 400 },
      );
    }

    const result = await findPhoneAuthUserByPhone(normalizedPhone);

    return NextResponse.json({
      ok: true,
      method: "phone",
      identifierType: "phone",
      identifier: normalizedPhone,
      normalizedPhone,
      maskedPhone: maskPhone(normalizedPhone),
      account: result?.user
        ? {
            name: result.user.name,
            email: result.user.email,
            phone: result.user.phone,
          }
        : null,
      message: result?.user
        ? `We found your account. Continue with SMS OTP to ${maskPhone(normalizedPhone)}.`
        : `Continue with SMS OTP to ${maskPhone(normalizedPhone)}. We will connect or create your customer account after verification.`,
    });
  } catch (error) {
    console.error("[auth/identify] failed:", error);
    return NextResponse.json({ ok: false, error: "Unable to continue right now. Please try again." }, { status: 500 });
  }
}
