import { redirect } from "next/navigation";
import DailyReportFinal from "@/components/daily-report-final";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import getLandingPage from "@/lib/getLandingPage";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";

export const dynamic = "force-dynamic";

async function resolveTechnicalViewer() {
  const session = await auth().catch(() => null);
  const sessionUser = session?.user as
    | {
        id?: string | null;
        role?: string | null;
        attendantCategory?: string | null;
      }
    | undefined;

  if (!session || !sessionUser?.id) {
    redirect("/login");
  }

  const isAdmin = sessionUser.role === "ADMIN";

  const adminPreviewUser = isAdmin
    ? await prisma.user.findFirst({
        where: {
          attendantCategory: "TECHNICAL_TEAM",
          isActive: true,
        },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          attendantCategory: true,
          isActive: true,
        },
      })
    : null;

  const targetId = adminPreviewUser?.id || sessionUser.id;
  const viewer = adminPreviewUser
    ? adminPreviewUser
    : await prisma.user.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          name: true,
          email: true,
          attendantCategory: true,
          isActive: true,
        },
      });

  if (!viewer || !viewer.isActive) {
    redirect("/login");
  }

  if (sessionUser.role !== "ADMIN" && !isTechnicalTeamCategory(viewer.attendantCategory)) {
    redirect(getLandingPage(viewer.attendantCategory ?? null, sessionUser.role ?? undefined));
  }

  return {
    targetUserId: viewer.id,
    isAdminPreview: Boolean(adminPreviewUser),
  };
}

export default async function TechnicalDailyReportPage() {
  const viewer = await resolveTechnicalViewer();

  return (
    <DailyReportFinal
      initialSection="daily-report"
      initialImpersonateId={viewer.isAdminPreview ? viewer.targetUserId : null}
    />
  );
}
