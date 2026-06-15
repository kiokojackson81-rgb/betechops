import { Role, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAgentLeadOwnershipTableAvailable } from "@/lib/agentLeadOwnershipTable";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";

type FirebasePhoneUserRecord = Pick<
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

export type FirebasePhoneAuthResult = {
  user: FirebasePhoneUserRecord;
  redirectTo: string;
  requiresProfileCompletion: boolean;
  normalizedPhone: string;
};

function getPreferredRedirect(user: FirebasePhoneUserRecord) {
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
      phone: {
        in: getKenyanPhoneVariants(normalizedPhone),
      },
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

export async function resolveFirebasePhoneUser(idToken: string): Promise<FirebasePhoneAuthResult> {
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
        lastLoginMethod: "firebase_phone",
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
