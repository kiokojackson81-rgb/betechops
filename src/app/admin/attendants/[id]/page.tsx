import { prisma } from "@/lib/prisma";
import AttendantEditorClient from "./AttendantEditorClient";
import { getCategoryLabel } from "@/lib/getLandingPage";

type Props = { params: { id: string }; searchParams?: Record<string, string | string[] | undefined> };

export default async function AttendantEditPage({ params, searchParams }: Props) {
  const { id } = params;
  const attendant = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
  });
  if (!attendant) return <div className="p-8">Attendant not found</div>;

  return <AttendantEditorClient attendant={attendant} getCategoryLabel={getCategoryLabel} />;
}
