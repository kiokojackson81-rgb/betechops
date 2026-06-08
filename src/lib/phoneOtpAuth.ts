import crypto from "node:crypto";
import { Role, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";

type PhoneAuthUserRecord = Pick<
  User,
  "id" | "email" | "phone" | "name" | "role" | "attendantCategory" | "isActive" | "phoneVerifiedAt" | "emailVerifiedAt" | "lastLoginMethod" | "county" | "town"
> & {
  agentProfile: {
    id: string;
    status: string;
    phone: string | null;
    email: string | null;
  } | null;
};

export type PhoneAuthResult = {
  user: PhoneAuthUserRecord;
  redirectTo: string;
  requiresProfileCompletion: boolean;
  normalizedPhone: string;
};

type VerifiedPhoneTokenPayload = {
  userId: string;
  phone: string;
  redirectTo: string;
  requiresProfileCompletion: boolean;
  exp: number;
};

const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFIED_TOKEN_TTL_MS = 10 * 60 * 1000;
const OTP_ATTEMPT_LIMIT = 5;

function getOtpHashSecret() {
  return process.env.OTP_HASH_SECRET || process.env.NEXTAUTH_SECRET || process.env.SECRET || "dev-otp-secret";
}

function getVerifiedTokenSecret() {
  return process.env.PHONE_OTP_SESSION_SECRET || process.env.NEXTAUTH_SECRET || process.env.SECRET || "dev-phone-session-secret";
}

function hmacHex(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function hashOtpCode(phone: string, code: string) {
  return hmacHex(`${phone}:${code}`, getOtpHashSecret());
}

export function generateOtpCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function createOtpCode(phoneInput: string) {
  const normalizedPhone = normalizeKenyanPhone(phoneInput);
  if (!normalizedPhone) {
    throw new Error("Enter a valid Kenyan phone number like 0712345678.");
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  try {
    const codeHash = hashOtpCode(normalizedPhone, code);
    const [retired, created] = await prisma.$transaction([
      prisma.otpCode.updateMany({
        where: {
          phone: normalizedPhone,
          used: false,
        },
        data: {
          used: true,
        },
      }),
      prisma.otpCode.create({
        data: {
          phone: normalizedPhone,
          codeHash,
          expiresAt,
        },
      }),
    ]);

    console.info("[otp] OTP save success", {
      phone: normalizedPhone,
      expiresAt: expiresAt.toISOString(),
      retiredCount: retired.count,
      otpId: created.id,
    });
  } catch (error) {
    console.error("[otp] OTP save failure", {
      phone: normalizedPhone,
      expiresAt: expiresAt.toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  return { normalizedPhone, code, expiresAt };
}

function getPreferredRedirect(user: PhoneAuthUserRecord) {
  if (user.role === Role.ADMIN) return "/admin";
  if (user.agentProfile) return "/agents/dashboard";
  return "/account";
}

function requiresProfileCompletion(user: PhoneAuthUserRecord) {
  return !String(user.name || "").trim() || !String(user.email || "").trim();
}

async function syncVerifiedIdentityLinks(userId: string, normalizedPhone: string) {
  const variants = getKenyanPhoneVariants(normalizedPhone);
  if (!variants.length) return;

  await prisma.$transaction([
    prisma.agentLeadOwnership.updateMany({
      where: {
        customerUserId: null,
        normalizedPhone,
      },
      data: {
        customerUserId: userId,
      },
    }),
    prisma.agentSale.updateMany({
      where: {
        customerUserId: null,
        customerPhone: { in: variants },
      },
      data: {
        customerUserId: userId,
      },
    }),
    prisma.websiteOrder.updateMany({
      where: {
        customerUserId: null,
        customerPhone: { in: variants },
      },
      data: {
        customerUserId: userId,
      },
    }),
  ]);
}

async function resolveUserByPhone(normalizedPhone: string) {
  const directUser = await prisma.user.findUnique({
    where: { phone: normalizedPhone },
    include: {
      agentProfile: {
        select: {
          id: true,
          status: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  if (directUser) return directUser;

  const agentProfile = await prisma.agentProfile.findFirst({
    where: {
      OR: [
        { phone: { in: getKenyanPhoneVariants(normalizedPhone) } },
        { user: { phone: normalizedPhone } },
      ],
    },
    include: {
      user: {
        include: {
          agentProfile: {
            select: {
              id: true,
              status: true,
              phone: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return agentProfile?.user ?? null;
}

async function resolveVerifiedPhoneUser(normalizedPhone: string): Promise<PhoneAuthResult> {
  let user = await resolveUserByPhone(normalizedPhone);

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
        lastLoginMethod: "africastalking_otp",
        role: Role.ATTENDANT,
      },
      include: {
        agentProfile: {
          select: {
            id: true,
            status: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  } else {
    if (!user.isActive) {
      throw new Error("This account is inactive. Please contact Betech support.");
    }

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
        lastLoginMethod: "africastalking_otp",
        agentProfile: user.agentProfile
          ? {
              update: {
                phone: normalizedPhone,
              },
            }
          : undefined,
      },
      include: {
        agentProfile: {
          select: {
            id: true,
            status: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }

  await syncVerifiedIdentityLinks(user.id, normalizedPhone);

  return {
    user,
    redirectTo: getPreferredRedirect(user),
    requiresProfileCompletion: requiresProfileCompletion(user),
    normalizedPhone,
  };
}

export async function verifyOtpCode(phoneInput: string, codeInput: string) {
  const normalizedPhone = normalizeKenyanPhone(phoneInput);
  if (!normalizedPhone) {
    throw new Error("Enter a valid Kenyan phone number like 0712345678.");
  }

  const code = String(codeInput || "").trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Enter the 6-digit OTP we sent by SMS.");
  }

  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      phone: normalizedPhone,
      used: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otpRecord || otpRecord.expiresAt.getTime() < Date.now()) {
    if (otpRecord && !otpRecord.used) {
      await prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { used: true },
      });
    }
    throw new Error("This OTP has expired. Please request a new code.");
  }

  const codeHash = hashOtpCode(normalizedPhone, code);
  const matches = crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(otpRecord.codeHash));

  if (!matches) {
    const nextAttempts = otpRecord.attempts + 1;
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: {
        attempts: nextAttempts,
        used: nextAttempts >= OTP_ATTEMPT_LIMIT,
      },
    });
    throw new Error(nextAttempts >= OTP_ATTEMPT_LIMIT ? "Too many incorrect attempts. Request a new OTP." : "The OTP you entered is incorrect.");
  }

  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { used: true },
  });

  return resolveVerifiedPhoneUser(normalizedPhone);
}

export function createVerifiedPhoneToken(result: PhoneAuthResult) {
  const payload: VerifiedPhoneTokenPayload = {
    userId: result.user.id,
    phone: result.normalizedPhone,
    redirectTo: result.redirectTo,
    requiresProfileCompletion: result.requiresProfileCompletion,
    exp: Date.now() + VERIFIED_TOKEN_TTL_MS,
  };

  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = hmacHex(encoded, getVerifiedTokenSecret());
  return `${encoded}.${signature}`;
}

export function readVerifiedPhoneToken(token: string) {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) {
    throw new Error("Missing phone verification token.");
  }

  const expectedSignature = hmacHex(encoded, getVerifiedTokenSecret());
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error("Invalid phone verification token.");
  }

  const payload = JSON.parse(base64UrlDecode(encoded)) as VerifiedPhoneTokenPayload;
  if (!payload?.userId || !payload?.phone || !payload?.exp) {
    throw new Error("Invalid phone verification token.");
  }
  if (payload.exp < Date.now()) {
    throw new Error("Phone verification token expired.");
  }

  return payload;
}
