import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sendOtpSms } from "@/lib/africasTalking";
import { prisma } from "@/lib/prisma";
import {
  createStephenLoginOtp,
  isStephenOtpProtectedUser,
  maskedStephenOtpPhone,
  STEPHEN_OTP_EMAIL,
  STEPHEN_OTP_PHONE,
} from "@/lib/stephenLoginOtp";

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const requests = new Map<string, number[]>();

function allowRequest(request: NextRequest) {
  const ip = String(request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "global").split(",")[0].trim();
  const now = Date.now();
  const recent = (requests.get(ip) || []).filter((time) => time > now - WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return false;
  recent.push(now);
  requests.set(ip, recent);
  return true;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!allowRequest(request)) {
    return NextResponse.json({ ok: false, error: "Too many sign-in attempts. Please wait before trying again." }, { status: 429 });
  }

  // This route can only begin the additional factor for the specified account.
  if (email !== STEPHEN_OTP_EMAIL || !password) {
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, password: true, isActive: true },
  });
  if (!user || !user.isActive || !user.password || !isStephenOtpProtectedUser(user) || !(await bcrypt.compare(password, user.password))) {
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }

  const challenge = await createStephenLoginOtp();
  try {
    await sendOtpSms(STEPHEN_OTP_PHONE, challenge.code);
  } catch (error) {
    await prisma.otpCode.update({ where: { id: challenge.challengeId }, data: { used: true } }).catch(() => undefined);
    console.error("[stephen-login-otp] SMS delivery failed", error);
    return NextResponse.json({ ok: false, error: "We could not send the verification SMS. Please try again." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, challengeId: challenge.challengeId, phone: maskedStephenOtpPhone() });
}
