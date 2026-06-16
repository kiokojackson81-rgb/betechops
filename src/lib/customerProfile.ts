import { prisma } from "@/lib/prisma";

const OPTIONAL_USER_PROFILE_COLUMNS = ["whatsappNumber", "county", "town", "estateLandmark", "locationNotes"] as const;

type OptionalUserProfileColumn = (typeof OPTIONAL_USER_PROFILE_COLUMNS)[number];

type UserProfileColumnMap = Record<OptionalUserProfileColumn, boolean>;

type CustomerProfileInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  county?: string | null;
  town?: string | null;
  estateLandmark?: string | null;
  locationNotes?: string | null;
};

type SafeCustomerProfile = {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  county?: string | null;
  town?: string | null;
  estateLandmark?: string | null;
  locationNotes?: string | null;
};

let cachedColumns: { expiresAt: number; value: UserProfileColumnMap } | null = null;

function defaultColumnMap(): UserProfileColumnMap {
  return {
    whatsappNumber: false,
    county: false,
    town: false,
    estateLandmark: false,
    locationNotes: false,
  };
}

export async function getUserProfileColumnMap(forceRefresh = false): Promise<UserProfileColumnMap> {
  if (!forceRefresh && cachedColumns && cachedColumns.expiresAt > Date.now()) {
    return cachedColumns.value;
  }

  const columnMap = defaultColumnMap();

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'User'
          AND column_name IN ('whatsappNumber', 'county', 'town', 'estateLandmark', 'locationNotes')
      `,
    );

    for (const row of rows) {
      const columnName = row?.column_name as OptionalUserProfileColumn | undefined;
      if (columnName && columnName in columnMap) {
        columnMap[columnName] = true;
      }
    }
  } catch (error) {
    console.error("[customer-profile] failed to inspect user columns", error);
  }

  cachedColumns = {
    value: columnMap,
    expiresAt: Date.now() + 60_000,
  };

  return columnMap;
}

export async function findSafeCustomerProfileByUserId(userId: string): Promise<SafeCustomerProfile | null> {
  const columns = await getUserProfileColumnMap();
  const selectedColumns = ["id", "name", "email", "phone", ...OPTIONAL_USER_PROFILE_COLUMNS.filter((column) => columns[column])] as string[];
  const selectSql = selectedColumns.map((column) => `"${column}"`).join(", ");

  try {
    const rows = await prisma.$queryRawUnsafe<Array<SafeCustomerProfile>>(
      `SELECT ${selectSql} FROM "User" WHERE id = $1 LIMIT 1`,
      userId,
    );

    return rows[0] ?? null;
  } catch (error) {
    const message = String((error as Error)?.message || "");
    if (message.includes("does not exist in the current database")) {
      const refreshedColumns = await getUserProfileColumnMap(true);
      const fallbackColumns = ["id", "name", "email", "phone", ...OPTIONAL_USER_PROFILE_COLUMNS.filter((column) => refreshedColumns[column])] as string[];
      const fallbackSelectSql = fallbackColumns.map((column) => `"${column}"`).join(", ");
      const rows = await prisma.$queryRawUnsafe<Array<SafeCustomerProfile>>(
        `SELECT ${fallbackSelectSql} FROM "User" WHERE id = $1 LIMIT 1`,
        userId,
      );
      return rows[0] ?? null;
    }
    throw error;
  }
}

export async function updateSafeCustomerProfile(userId: string, input: CustomerProfileInput): Promise<SafeCustomerProfile> {
  const columns = await getUserProfileColumnMap();
  const updates: Array<[string, string | null]> = [
    ["name", input.name ?? null],
    ["email", input.email ?? null],
  ];

  if (typeof input.phone !== "undefined") {
    updates.push(["phone", input.phone]);
  }
  if (columns.whatsappNumber && typeof input.whatsappNumber !== "undefined") {
    updates.push(["whatsappNumber", input.whatsappNumber]);
  }
  if (columns.county && typeof input.county !== "undefined") {
    updates.push(["county", input.county]);
  }
  if (columns.town && typeof input.town !== "undefined") {
    updates.push(["town", input.town]);
  }
  if (columns.estateLandmark && typeof input.estateLandmark !== "undefined") {
    updates.push(["estateLandmark", input.estateLandmark]);
  }
  if (columns.locationNotes && typeof input.locationNotes !== "undefined") {
    updates.push(["locationNotes", input.locationNotes]);
  }

  const assignments = updates.map(([column], index) => `"${column}" = $${index + 2}`).join(", ");
  const values = updates.map(([, value]) => value);

  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET ${assignments}, "updatedAt" = NOW() WHERE id = $1`,
    userId,
    ...values,
  );

  return {
    id: userId,
    name: typeof input.name === "undefined" ? null : input.name,
    email: typeof input.email === "undefined" ? null : input.email,
    phone: typeof input.phone === "undefined" ? null : input.phone,
    whatsappNumber: columns.whatsappNumber ? (typeof input.whatsappNumber === "undefined" ? null : input.whatsappNumber) : null,
    county: columns.county ? (typeof input.county === "undefined" ? null : input.county) : null,
    town: columns.town ? (typeof input.town === "undefined" ? null : input.town) : null,
    estateLandmark: columns.estateLandmark ? (typeof input.estateLandmark === "undefined" ? null : input.estateLandmark) : null,
    locationNotes: columns.locationNotes ? (typeof input.locationNotes === "undefined" ? null : input.locationNotes) : null,
  };
}
