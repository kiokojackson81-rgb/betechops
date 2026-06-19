import crypto from "node:crypto";
import { Role, type User } from "@prisma/client";
import { updateSafeUserById } from "@/lib/customerProfile";
import { prisma } from "@/lib/prisma";
import { isAgentLeadOwnershipTableAvailable } from "@/lib/agentLeadOwnershipTable";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";

export type AuthOtpChannel = "phone" | "email";

type OtpAuthUserRecord = Pick<
  User,
  "id" | "email" | "phone" | "name" | "role" | "attendantCategory" | "isActive" | "phoneVerifiedAt" | "emailVerifiedAt" | "lastLoginMethod"
> & {
  agentProfile: {
    id: string;
    status: string;
    phone: string | null;
    email: string | null;
  } | null;
};

const otpAuthUserSelect = {
  id: true,
  email: true,
  phone: true,
  name: true,
  role: true,
  attendantCategory: true,
  isActive: true,
  phoneVerifiedAt: true,
  emailVerifiedAt: true,
  lastLoginMethod: true,
  agentProfile: {
    select: {
      id: true,
      status: true,
      phone: true,
      email: true,
    },
  },
} as const;

export type OtpAuthResult = {
  user: OtpAuthUserRecord;
  redirectTo: string;
  requiresProfileCompletion: boolean;
  channel: AuthOtpChannel;
  identifier: string;
};

type VerifiedAuthTokenPayload = {
  userId: string;
  channel: AuthOtpChannel;
  identifier: string;
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

function normalizeEmailIdentifier(input?: string) {
  const email = String(input || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeOtpIdentifier(channel: AuthOtpChannel, rawIdentifier: string) {
  if (channel === "phone") {
    const normalizedPhone = normalizeKenyanPhone(rawIdentifier);
    if (!normalizedPhone) {
      throw new Error("Enter a valid Kenyan phone number like 0712345678 or 0101234567.");
    }
    return {
      normalizedIdentifier: normalizedPhone,
      storageKey: `phone:${normalizedPhone}`,
    };
  }

  const normalizedEmail = normalizeEmailIdentifier(rawIdentifier);
  if (!normalizedEmail) {
    throw new Error("Enter a valid email address.");
  }

  return {
    normalizedIdentifier: normalizedEmail,
    storageKey: `email:${normalizedEmail}`,
  };
}

export async function createOtpCodeForChannel(channel: AuthOtpChannel, rawIdentifier: string) {
  const { normalizedIdentifier, storageKey } = normalizeOtpIdentifier(channel, rawIdentifier);

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  try {
    const codeHash = hashOtpCode(storageKey, code);
    const [retired, created] = await prisma.$transaction([
      prisma.otpCode.updateMany({
        where: {
          phone: storageKey,
          used: false,
        },
        data: {
          used: true,
        },
      }),
      prisma.otpCode.create({
        data: {
          phone: storageKey,
          codeHash,
          expiresAt,
        },
      }),
    ]);

    console.info("[otp] OTP save success", {
      channel,
      identifier: normalizedIdentifier,
      expiresAt: expiresAt.toISOString(),
      retiredCount: retired.count,
      otpId: created.id,
    });
  } catch (error) {
    console.error("[otp] OTP save failure", {
      channel,
      identifier: normalizedIdentifier,
      expiresAt: expiresAt.toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  return { normalizedIdentifier, storageKey, code, expiresAt };
}

export async function createOtpCode(phoneInput: string) {
  const result = await createOtpCodeForChannel("phone", phoneInput);
  return {
    normalizedPhone: result.normalizedIdentifier,
    code: result.code,
    expiresAt: result.expiresAt,
  };
}

function normalizePreferredRedirect(value?: string | null) {
  const redirect = String(value || "").trim();
  if (!redirect.startsWith("/")) return "";
  return redirect;
}

function getPreferredRedirect(user: OtpAuthUserRecord, preferredRedirect?: string | null) {
  const normalizedPreferredRedirect = normalizePreferredRedirect(preferredRedirect);
  if (normalizedPreferredRedirect) return normalizedPreferredRedirect;
  if (user.role === Role.ADMIN) return "/admin";
  if (user.agentProfile) return "/agents/dashboard";
  return "/account";
}

function requiresProfileCompletion(user: OtpAuthUserRecord) {
  return !String(user.name || "").trim() || !String(user.email || "").trim();
}

async function syncVerifiedIdentityLinks(userId: string, normalizedPhone: string) {
  const variants = getKenyanPhoneVariants(normalizedPhone);
  if (!variants.length) return;

  const updates = [
    prisma.agentSale.updateMany({
      where: { customerPhone: { in: variants } },
      data: {
        customerUserId: userId,
      },
    }),
    prisma.websiteOrder.updateMany({
      where: { customerPhone: { in: variants } },
      data: {
        customerUserId: userId,
      },
    }),
  ];

  if (await isAgentLeadOwnershipTableAvailable()) {
    updates.unshift(
      prisma.agentLeadOwnership.updateMany({
        where: { normalizedPhone },
        data: {
          customerUserId: userId,
        },
      }),
    );
  }

  await prisma.$transaction(updates);
}

async function resolveUserByPhone(normalizedPhone: string) {
  const directUser = await prisma.user.findUnique({
    where: { phone: normalizedPhone },
    select: otpAuthUserSelect,
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
        select: otpAuthUserSelect,
      },
    },
  });

  return agentProfile?.user ?? null;
}

async function resolveUserByEmail(normalizedEmail: string) {
  const directUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: otpAuthUserSelect,
  });

  if (directUser) return directUser;

  const agentProfile = await prisma.agentProfile.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
    include: {
      user: {
        select: otpAuthUserSelect,
      },
    },
  });

  return agentProfile?.user ?? null;
}

export async function findPhoneAuthUserByPhone(phoneInput: string) {
  const normalizedPhone = normalizeKenyanPhone(phoneInput);
  if (!normalizedPhone) return null;

  const user = await resolveUserByPhone(normalizedPhone);
  if (!user) return null;

  return {
    normalizedPhone,
    user,
  };
}

export async function findPhoneAuthUserByEmail(emailInput: string) {
  const email = normalizeEmailIdentifier(emailInput);
  if (!email) return null;
  const user = await resolveUserByEmail(email);
  if (!user) return null;
  const normalizedPhone = normalizeKenyanPhone(user.phone || user.agentProfile?.phone || "");
  return {
    email,
    normalizedPhone,
    user,
  };
}

async function resolveVerifiedPhoneUser(normalizedPhone: string, preferredRedirect?: string | null): Promise<OtpAuthResult> {
  let user = await resolveUserByPhone(normalizedPhone);

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
        lastLoginMethod: "africastalking_otp",
        role: Role.ATTENDANT,
      },
      select: otpAuthUserSelect,
    });
  } else {
    if (!user.isActive) {
      throw new Error("This account is inactive. Please contact Betech support.");
    }

    await updateSafeUserById(user.id, {
      phone: normalizedPhone,
      phoneVerifiedAt: new Date(),
      lastLoginMethod: "africastalking_otp",
    });
    if (user.agentProfile) {
      await prisma.agentProfile.update({
        where: { id: user.agentProfile.id },
        data: {
          phone: normalizedPhone,
        },
      });
    }
    user = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: otpAuthUserSelect,
    });
  }

  await syncVerifiedIdentityLinks(user.id, normalizedPhone);

  return {
    user,
    redirectTo: getPreferredRedirect(user, preferredRedirect),
    requiresProfileCompletion: requiresProfileCompletion(user),
    channel: "phone",
    identifier: normalizedPhone,
  };
}

async function resolveVerifiedEmailUser(normalizedEmail: string, preferredRedirect?: string | null): Promise<OtpAuthResult> {
  let user = await resolveUserByEmail(normalizedEmail);

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        emailVerifiedAt: new Date(),
        lastLoginMethod: "email_otp",
        role: Role.ATTENDANT,
      },
      select: otpAuthUserSelect,
    });
  } else {
    if (!user.isActive) {
      throw new Error("This account is inactive. Please contact Betech support.");
    }

    await updateSafeUserById(user.id, {
      email: normalizedEmail,
      emailVerifiedAt: new Date(),
      lastLoginMethod: "email_otp",
    });
    if (user.agentProfile) {
      await prisma.agentProfile.update({
        where: { id: user.agentProfile.id },
        data: {
          email: normalizedEmail,
        },
      });
    }
    user = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: otpAuthUserSelect,
    });
  }

  return {
    user,
    redirectTo: getPreferredRedirect(user, preferredRedirect),
    requiresProfileCompletion: requiresProfileCompletion(user),
    channel: "email",
    identifier: normalizedEmail,
  };
}

export async function verifyOtpCodeForChannel(
  channel: AuthOtpChannel,
  rawIdentifier: string,
  codeInput: string,
  preferredRedirect?: string | null,
) {
  const { normalizedIdentifier, storageKey } = normalizeOtpIdentifier(channel, rawIdentifier);
  const code = String(codeInput || "").trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Enter the 6-digit OTP we sent.");
  }

  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      phone: storageKey,
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

  const codeHash = hashOtpCode(storageKey, code);
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

  if (channel === "email") {
    return resolveVerifiedEmailUser(normalizedIdentifier, preferredRedirect);
  }

  return resolveVerifiedPhoneUser(normalizedIdentifier, preferredRedirect);
}

export async function verifyOtpCode(phoneInput: string, codeInput: string, preferredRedirect?: string | null) {
  return verifyOtpCodeForChannel("phone", phoneInput, codeInput, preferredRedirect);
}

export function createVerifiedAuthToken(result: OtpAuthResult) {
  const payload: VerifiedAuthTokenPayload = {
    userId: result.user.id,
    channel: result.channel,
    identifier: result.identifier,
    redirectTo: result.redirectTo,
    requiresProfileCompletion: result.requiresProfileCompletion,
    exp: Date.now() + VERIFIED_TOKEN_TTL_MS,
  };

  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = hmacHex(encoded, getVerifiedTokenSecret());
  return `${encoded}.${signature}`;
}

export function createDirectVerifiedAuthToken(args: {
  userId: string;
  channel: AuthOtpChannel;
  identifier: string;
  redirectTo: string;
  requiresProfileCompletion: boolean;
}) {
  const payload: VerifiedAuthTokenPayload = {
    userId: args.userId,
    channel: args.channel,
    identifier: args.identifier,
    redirectTo: args.redirectTo,
    requiresProfileCompletion: args.requiresProfileCompletion,
    exp: Date.now() + VERIFIED_TOKEN_TTL_MS,
  };

  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = hmacHex(encoded, getVerifiedTokenSecret());
  return `${encoded}.${signature}`;
}

export function createVerifiedPhoneToken(result: OtpAuthResult) {
  return createVerifiedAuthToken(result);
}

export function readVerifiedAuthToken(token: string) {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) {
    throw new Error("Missing verification token.");
  }

  const expectedSignature = hmacHex(encoded, getVerifiedTokenSecret());
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error("Invalid verification token.");
  }

  const payload = JSON.parse(base64UrlDecode(encoded)) as VerifiedAuthTokenPayload;
  if (!payload?.userId || !payload?.identifier || !payload?.channel || !payload?.exp) {
    throw new Error("Invalid verification token.");
  }
  if (payload.exp < Date.now()) {
    throw new Error("Verification token expired.");
  }

  return payload;
}

export function readVerifiedPhoneToken(token: string) {
  return readVerifiedAuthToken(token);
}
