import { Role, type User } from "@prisma/client";
import { updateSafeUserById } from "@/lib/customerProfile";
import { prisma } from "@/lib/prisma";
import { isAgentLeadOwnershipTableAvailable } from "@/lib/agentLeadOwnershipTable";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";

type FirebasePhoneUserRecord = Pick<
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

const firebasePhoneUserSelect = {
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

export type FirebasePhoneAuthResult = {
  user: FirebasePhoneUserRecord;
  redirectTo: string;
  requiresProfileCompletion: boolean;
  normalizedPhone: string;
};

function normalizePreferredRedirect(value?: string | null) {
  const redirect = String(value || "").trim();
  if (!redirect.startsWith("/")) return "";
  return redirect;
}

function getPreferredRedirect(user: FirebasePhoneUserRecord, preferredRedirect?: string | null) {
  const normalizedPreferredRedirect = normalizePreferredRedirect(preferredRedirect);
  if (normalizedPreferredRedirect) return normalizedPreferredRedirect;
  if (user.role === Role.ADMIN) {
    return "/admin";
  }
  if (user.agentProfile) {
    return "/agents/dashboard";
  }
  return "/account";
}

function requiresProfileCompletion(user: FirebasePhoneUserRecord) {
  return !String(user.name || "").trim() || !String(user.email || "").trim();
}

async function syncVerifiedIdentityLinks(userId: string, normalizedPhone: string) {
  const variants = getKenyanPhoneVariants(normalizedPhone);
  if (!variants.length) return;

  const updates = [
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
  ];

  if (await isAgentLeadOwnershipTableAvailable()) {
    updates.unshift(
      prisma.agentLeadOwnership.updateMany({
        where: {
          customerUserId: null,
          normalizedPhone,
        },
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
    select: firebasePhoneUserSelect,
  });

  if (directUser) return directUser;

  const agentProfile = await prisma.agentProfile.findFirst({
    where: {
      phone: {
        in: getKenyanPhoneVariants(normalizedPhone),
      },
    },
    include: {
      user: {
        select: firebasePhoneUserSelect,
      },
    },
  });

  return agentProfile?.user ?? null;
}

export async function resolveFirebasePhoneUser(idToken: string, preferredRedirect?: string | null): Promise<FirebasePhoneAuthResult> {
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const normalizedPhone = normalizeKenyanPhone(decoded.phone_number);

  if (!normalizedPhone) {
    throw new Error("A valid Kenyan phone number is required for phone sign-in.");
  }

  let user = await resolveUserByPhone(normalizedPhone);

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: normalizedPhone,
        phoneVerifiedAt: new Date(),
        lastLoginMethod: "firebase_phone",
        role: Role.ATTENDANT,
      },
      select: firebasePhoneUserSelect,
    });
  } else {
    if (!user.isActive) {
      throw new Error("This account is inactive. Please contact Betech support.");
    }

    await updateSafeUserById(user.id, {
      phone: normalizedPhone,
      phoneVerifiedAt: new Date(),
      lastLoginMethod: "firebase_phone",
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
      select: firebasePhoneUserSelect,
    });
  }

  await syncVerifiedIdentityLinks(user.id, normalizedPhone);

  return {
    user,
    redirectTo: getPreferredRedirect(user, preferredRedirect),
    requiresProfileCompletion: requiresProfileCompletion(user),
    normalizedPhone,
  };
}
