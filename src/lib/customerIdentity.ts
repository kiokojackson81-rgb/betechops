import { Prisma } from "@prisma/client";
import { findSafeCustomerProfileByUserId, getUserProfileColumnMap } from "@/lib/customerProfile";
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

export async function findOrCreateCustomerIdentityUser(input: {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  county?: string | null;
  town?: string | null;
  estateLandmark?: string | null;
  locationNotes?: string | null;
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
  const hasPhoneIdentity = Boolean(normalizedPhone);
  const conflictingAccounts =
    Boolean(phoneUser?.id) &&
    Boolean(emailUser?.id) &&
    phoneUser!.id !== emailUser!.id;

  const existing = hasPhoneIdentity
    ? phoneUser
    : phoneUser && emailUser && phoneUser.id === emailUser.id
      ? phoneUser
      : phoneUser || emailUser;

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
    const updateData: Prisma.UserUpdateInput = {};
    if (patchInput.name && patchInput.name !== existing.name) updateData.name = patchInput.name;
    if (patchInput.phone && !existing.phone && (!phoneUser || phoneUser.id === existing.id)) updateData.phone = patchInput.phone;
    if (patchInput.email && !existing.email && (!emailUser || emailUser.id === existing.id) && !conflictingAccounts) updateData.email = patchInput.email;
    if (patchInput.county && !existing.county) updateData.county = patchInput.county;
    if (patchInput.town && !existing.town) updateData.town = patchInput.town;
    if (patchInput.estateLandmark && !existing.estateLandmark) updateData.estateLandmark = patchInput.estateLandmark;
    if (patchInput.locationNotes && !existing.locationNotes) updateData.locationNotes = patchInput.locationNotes;

    if (Object.keys(updateData).length) {
      await prisma.user.update({
        where: { id: existing.id },
        data: updateData,
      });
      const user = await findSafeUserById(existing.id);
      if (!user) throw new Error(`Failed to reload synced customer account ${existing.id}`);
      return {
        user,
        matchedBy: hasPhoneIdentity ? "phone" : emailUser?.id === existing.id ? "email" : "phone",
        emailConflict: conflictingAccounts,
        normalizedPhone,
        normalizedEmail,
      };
    }

    return {
      user: existing,
      matchedBy: hasPhoneIdentity ? "phone" : emailUser?.id === existing.id ? "email" : "phone",
      emailConflict: conflictingAccounts,
      normalizedPhone,
      normalizedEmail,
    };
  }

  const createdUser = await prisma.user.create({
    data: {
      name: patchInput.name || null,
      phone: patchInput.phone || null,
      email: patchInput.email && !emailUser ? patchInput.email : null,
      county: patchInput.county,
      town: patchInput.town,
      estateLandmark: patchInput.estateLandmark,
      locationNotes: patchInput.locationNotes,
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
