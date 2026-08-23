import { prisma } from "@/lib/prisma";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";
import type { SerializedSiteVisit } from "@/lib/siteVisitShared";

export type SiteVisitAccessActor = {
  id: string;
  role: string | null;
  name: string | null;
  email: string | null;
  attendantCategory: string | null;
  canViewAll: boolean;
  canManageCommercials: boolean;
};

export async function getSiteVisitAccessActor(sessionUser: {
  id?: string | null;
  role?: string | null;
  name?: string | null;
  email?: string | null;
  attendantCategory?: string | null;
} | null | undefined): Promise<SiteVisitAccessActor | null> {
  if (!sessionUser?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, name: true, email: true, attendantCategory: true, technicalProfile: true, isActive: true },
  });
  if (!user?.isActive) return null;
  const isAdmin = user.role === "ADMIN" || user.role === "SUPERVISOR";
  const technical = isTechnicalTeamCategory(user.attendantCategory);
  if (!isAdmin && !technical) return null;
  const profile = user.technicalProfile && typeof user.technicalProfile === "object"
    ? user.technicalProfile as Record<string, unknown>
    : {};
  const roleLabel = String(profile.teamRole || profile.positionTitle || "").toLowerCase();
  const permissionScope = String(profile.permissionScope || "").toUpperCase();
  const technicalManager = technical && (roleLabel.includes("manager") || permissionScope === "FULL_TECHNICAL_ACCESS");
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    attendantCategory: user.attendantCategory,
    canViewAll: isAdmin || technicalManager,
    canManageCommercials: isAdmin,
  };
}

export function canAccessSiteVisit(actor: SiteVisitAccessActor, visit: SerializedSiteVisit) {
  return actor.canViewAll || visit.assignedStaffId === actor.id || visit.assignedTechnicianId === actor.id;
}
