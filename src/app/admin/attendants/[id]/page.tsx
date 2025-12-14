import { prisma } from "@/lib/prisma";
import AttendantEditorClient from "./AttendantEditorClient";
import { getCategoryLabel } from "@/lib/getLandingPage";

export default async function AttendantEditPage({ params }: { params: any }) {
  // Defensively handle `params` which may be a Promise in some runtimes.
  let resolvedParams = params;
  if (resolvedParams && typeof resolvedParams.then === "function") {
    try {
      resolvedParams = await resolvedParams;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[admin/attendants] failed to resolve params", { err: e });
      resolvedParams = null;
    }
  }
  const { id } = (resolvedParams ?? {}) as { id: string };
  const attendant = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });
  if (!attendant) return <div className="p-8">Attendant not found</div>;

  const prepared = {
    ...attendant,
    categoryLabel: getCategoryLabel(attendant.attendantCategory),
  };

  return <AttendantEditorClient attendant={prepared} />;
}
