import { redirect } from "next/navigation";
import ProjectsOperationsClient from "@/app/admin/returns/ProjectsOperationsClient";
import { auth } from "@/lib/auth";
import getLandingPage from "@/lib/getLandingPage";
import { prisma } from "@/lib/prisma";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";

export const dynamic = "force-dynamic";

async function resolveViewer() {
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

  return viewer;
}

export default async function TechnicalProjectsPage() {
  const viewer = await resolveViewer();
  return <ProjectsOperationsClient scope="technical" viewerId={viewer.id} />;
}
