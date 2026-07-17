import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import getLandingPage from "@/lib/getLandingPage";
import TechnicalShell from "./_components/TechnicalShell";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";

export const dynamic = "force-dynamic";

export default async function TechnicalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth().catch(() => null);
  const user = session?.user as
    | {
        name?: string | null;
        email?: string | null;
        role?: string | null;
        attendantCategory?: string | null;
      }
    | undefined;

  if (!session || !user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN" && !isTechnicalTeamCategory(user.attendantCategory)) {
    redirect(getLandingPage(user.attendantCategory ?? null, user.role ?? undefined));
  }

  return (
    <TechnicalShell
      viewer={{
        name: user.name || user.email || "Technical user",
        email: user.email || "-",
        roleLabel: isTechnicalTeamCategory(user.attendantCategory) ? "Technical Team" : user.role || "Admin",
      }}
    >
      {children}
    </TechnicalShell>
  );
}
