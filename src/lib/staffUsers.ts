import type { Prisma, Role } from "@prisma/client";

export const STAFF_ATTENDANT_ROLES: Role[] = ["ATTENDANT", "SUPERVISOR"];

export function isStaffAttendantLike(user: {
  role?: Role | string | null;
  attendantCategory?: string | null;
  categories?: Array<string | null | undefined>;
  hasAgentProfile?: boolean;
}) {
  const role = String(user.role ?? "").toUpperCase();
  if (!STAFF_ATTENDANT_ROLES.includes(role as Role)) return false;
  if (user.hasAgentProfile) return false;

  const directCategory = String(user.attendantCategory ?? "").trim();
  if (directCategory) return true;

  return (user.categories ?? []).some((category) => String(category ?? "").trim().length > 0);
}

export function buildStaffAttendantWhere(): Prisma.UserWhereInput {
  return {
    role: { in: STAFF_ATTENDANT_ROLES },
    agentProfile: { is: null },
    OR: [
      { attendantCategory: { not: null } },
      { categoryAssignments: { some: {} } },
    ],
  };
}
