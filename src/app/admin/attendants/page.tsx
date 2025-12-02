import { prisma } from "@/lib/prisma";
import AttendantsClient from "./AttendantsClient";
import { getCategoryLabel } from "@/lib/getLandingPage";

export default async function AdminAttendantsPage() {
  const attendants = await prisma.user.findMany({
    where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } },
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      attendantCategory: true,
      isActive: true,
      createdAt: true,
    },
  });

  const prepared = attendants.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
  }));

  return <AttendantsClient attendants={prepared} getCategoryLabel={getCategoryLabel} />;
}
