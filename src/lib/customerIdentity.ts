import { Prisma } from "@prisma/client";
import { findSafeCustomerProfileByUserId, getUserProfileColumnMap, updateSafeUserById } from "@/lib/customerProfile";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export type SafeCustomerIdentityUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  county?: string | null;
  town?: string | null;
  estateLandmark?: string | null;
  locationNotes?: string | null;
};

export function normalizeCustomerIdentityEmail(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || "";
}

function pickFirstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function getSafeUserSelectSql(columns: Awaited<ReturnType<typeof getUserProfileColumnMap>>) {
  const selectedColumns = [
    "id",
    "name",
    "email",
    "phone",
    ...(columns.county ? ["county"] : []),
    ...(columns.town ? ["town"] : []),
    ...(columns.estateLandmark ? ["estateLandmark"] : []),
    ...(columns.locationNotes ? ["locationNotes"] : []),
  ];

  return selectedColumns.map((column) => `"${column}"`).join(", ");
}

function dedupeUsers(users: Array<SafeCustomerIdentityUser | null | undefined>) {
  const seen = new Set<string>();
  const deduped: SafeCustomerIdentityUser[] = [];
  for (const user of users) {
    if (!user?.id || seen.has(user.id)) continue;
    seen.add(user.id);
    deduped.push(user);
  }
  return deduped;
}

async function findSafeUserByField(field: "phone" | "email", value: string): Promise<SafeCustomerIdentityUser | null> {
  const columns = await getUserProfileColumnMap();
  const selectSql = getSafeUserSelectSql(columns);
  const rows = await prisma.$queryRawUnsafe<Array<SafeCustomerIdentityUser>>(
    `SELECT ${selectSql} FROM "User" WHERE "${field}" = $1 LIMIT 1`,
    value,
  );
  return rows[0] ?? null;
}

export async function findSafeUserById(userId: string): Promise<SafeCustomerIdentityUser | null> {
  const profile = await findSafeCustomerProfileByUserId(userId);
  if (!profile?.id) return null;
  return {
    id: profile.id,
    name: profile.name ?? null,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    county: profile.county ?? null,
    town: profile.town ?? null,
    estateLandmark: profile.estateLandmark ?? null,
    locationNotes: profile.locationNotes ?? null,
  };
}

export async function resolveExistingCustomerUsers(args: { normalizedPhone: string; normalizedEmail: string }) {
  const [phoneUser, emailUser] = await Promise.all([
    args.normalizedPhone ? findSafeUserByField("phone", args.normalizedPhone) : Promise.resolve(null),
    args.normalizedEmail ? findSafeUserByField("email", args.normalizedEmail) : Promise.resolve(null),
  ]);

  return { phoneUser, emailUser };
}

async function reassignQuoteRequestsCustomerUser(sourceUserIds: string[], targetUserId: string) {
  if (!sourceUserIds.length) return;

  await prisma.$executeRawUnsafe(
    `UPDATE "QuoteRequest"
      SET "customerUserId" = $1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "customerUserId" = ANY($2::text[])`,
    targetUserId,
    sourceUserIds,
  );
}

export async function mergeCustomerIdentityUsers(args: {
  targetUserId: string;
  sourceUserIds: string[];
}) {
  const sourceUserIds = args.sourceUserIds.filter((id) => id && id !== args.targetUserId);
  if (!sourceUserIds.length) return;

  console.log("[customerIdentity] merging duplicate users", {
    targetUserId: args.targetUserId,
    sourceUserIds,
  });

  await prisma.$transaction(async (tx) => {
    const agentProfiles = await tx.agentProfile.findMany({
      where: {
        userId: {
          in: [args.targetUserId, ...sourceUserIds],
        },
      },
      select: {
        id: true,
        userId: true,
        phone: true,
        email: true,
      },
    });

    const targetAgentProfile = agentProfiles.find((profile) => profile.userId === args.targetUserId) ?? null;
    const sourceAgentProfiles = agentProfiles.filter((profile) => profile.userId !== args.targetUserId);

    if (!targetAgentProfile && sourceAgentProfiles.length) {
      const sourceAgentProfile = sourceAgentProfiles[0];
      await tx.agentProfile.update({
        where: { id: sourceAgentProfile.id },
        data: {
          userId: args.targetUserId,
        },
      });
    }

    await Promise.all([
      tx.agentSale.updateMany({
        where: { customerUserId: { in: sourceUserIds } },
        data: { customerUserId: args.targetUserId },
      }),
      tx.websiteOrder.updateMany({
        where: { customerUserId: { in: sourceUserIds } },
        data: { customerUserId: args.targetUserId },
      }),
      tx.agentLeadOwnership.updateMany({
        where: { customerUserId: { in: sourceUserIds } },
        data: { customerUserId: args.targetUserId },
      }),
    ]);
  });

  await reassignQuoteRequestsCustomerUser(sourceUserIds, args.targetUserId);

  await prisma.agentProfile.updateMany({
    where: {
      userId: {
        in: sourceUserIds,
      },
    },
    data: {
      phone: null,
      email: null,
    },
  });

  for (const sourceUserId of sourceUserIds) {
    await updateSafeUserById(sourceUserId, {
      phone: null,
      email: null,
      whatsappNumber: null,
    });
  }
}

export async function findOrCreateCustomerIdentityUser(input: {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  county?: string | null;
  town?: string | null;
  estateLandmark?: string | null;
  locationNotes?: string | null;
  currentUserId?: string | null;
}): Promise<{
  user: SafeCustomerIdentityUser;
  matchedBy: "phone" | "email" | "created";
  emailConflict: boolean;
  normalizedPhone: string;
  normalizedEmail: string;
}> {
  const normalizedPhone = normalizeKenyanPhone(input.customerPhone || "");
  const normalizedEmail = normalizeCustomerIdentityEmail(input.customerEmail || "");
  const { phoneUser, emailUser } = await resolveExistingCustomerUsers({ normalizedPhone, normalizedEmail });
  const currentUser =
    input.currentUserId && input.currentUserId !== phoneUser?.id && input.currentUserId !== emailUser?.id
      ? await findSafeUserById(input.currentUserId)
      : phoneUser?.id === input.currentUserId
        ? phoneUser
        : emailUser?.id === input.currentUserId
          ? emailUser
          : null;
  const hasPhoneIdentity = Boolean(normalizedPhone);
  const conflictingAccounts =
    Boolean(phoneUser?.id) &&
    Boolean(emailUser?.id) &&
    phoneUser!.id !== emailUser!.id;
  const existingCandidates = dedupeUsers([
    hasPhoneIdentity ? phoneUser : null,
    emailUser,
    currentUser,
  ]);
  const existing =
    existingCandidates[0] ??
    null;

  const patchInput = {
    name: pickFirstNonEmpty(input.customerName),
    phone: normalizedPhone || null,
    email: normalizedEmail || null,
    county: pickFirstNonEmpty(input.county) || null,
    town: pickFirstNonEmpty(input.town) || null,
    estateLandmark: pickFirstNonEmpty(input.estateLandmark) || null,
    locationNotes: pickFirstNonEmpty(input.locationNotes) || null,
  };

  if (existing) {
    const sourceUsers = dedupeUsers([phoneUser, emailUser, currentUser]).filter((user) => user.id !== existing.id);
    if (sourceUsers.length) {
      await mergeCustomerIdentityUsers({
        targetUserId: existing.id,
        sourceUserIds: sourceUsers.map((user) => user.id),
      });
    }

    const mergedExisting = (await findSafeUserById(existing.id)) || existing;
    const updateData: Prisma.UserUpdateInput = {};
    if (patchInput.name && patchInput.name !== mergedExisting.name) updateData.name = patchInput.name;
    if (patchInput.phone && (!mergedExisting.phone || mergedExisting.phone !== patchInput.phone)) updateData.phone = patchInput.phone;
    if (patchInput.email && (!mergedExisting.email || mergedExisting.email !== patchInput.email) && (!conflictingAccounts || emailUser?.id === mergedExisting.id)) {
      updateData.email = patchInput.email;
    }
    if (patchInput.county && !mergedExisting.county) updateData.county = patchInput.county;
    if (patchInput.town && !mergedExisting.town) updateData.town = patchInput.town;
    if (patchInput.estateLandmark && !mergedExisting.estateLandmark) updateData.estateLandmark = patchInput.estateLandmark;
    if (patchInput.locationNotes && !mergedExisting.locationNotes) updateData.locationNotes = patchInput.locationNotes;

    if (Object.keys(updateData).length) {
      await updateSafeUserById(mergedExisting.id, {
        name: typeof updateData.name === "string" ? updateData.name : undefined,
        phone: typeof updateData.phone === "string" ? updateData.phone : undefined,
        email: typeof updateData.email === "string" ? updateData.email : undefined,
        county: typeof updateData.county === "string" ? updateData.county : undefined,
        town: typeof updateData.town === "string" ? updateData.town : undefined,
        estateLandmark: typeof updateData.estateLandmark === "string" ? updateData.estateLandmark : undefined,
        locationNotes: typeof updateData.locationNotes === "string" ? updateData.locationNotes : undefined,
      });
      const user = await findSafeUserById(mergedExisting.id);
      if (!user) throw new Error(`Failed to reload synced customer account ${mergedExisting.id}`);
      return {
        user,
        matchedBy: hasPhoneIdentity ? "phone" : emailUser?.id === existing.id ? "email" : "phone",
        emailConflict: conflictingAccounts,
        normalizedPhone,
        normalizedEmail,
      };
    }

    return {
      user: mergedExisting,
      matchedBy: hasPhoneIdentity ? "phone" : emailUser?.id === existing.id ? "email" : "phone",
      emailConflict: conflictingAccounts,
      normalizedPhone,
      normalizedEmail,
    };
  }

  const columns = await getUserProfileColumnMap();
  const createdUser = await prisma.user.create({
    data: {
      name: patchInput.name || null,
      phone: patchInput.phone || null,
      email: patchInput.email && !emailUser ? patchInput.email : null,
      ...(columns.county ? { county: patchInput.county } : {}),
      ...(columns.town ? { town: patchInput.town } : {}),
      ...(columns.estateLandmark ? { estateLandmark: patchInput.estateLandmark } : {}),
      ...(columns.locationNotes ? { locationNotes: patchInput.locationNotes } : {}),
    },
  });
  const user = await findSafeUserById(createdUser.id);
  if (!user) throw new Error(`Failed to load created customer account ${createdUser.id}`);
  return {
    user,
    matchedBy: "created",
    emailConflict: Boolean(emailUser) && hasPhoneIdentity,
    normalizedPhone,
    normalizedEmail,
  };
}
