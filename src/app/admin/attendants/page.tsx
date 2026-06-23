import { prisma } from "@/lib/prisma";
import AttendantsClient from "./AttendantsClient";
import { getCategoryLabel } from "@/lib/getLandingPage";
import { buildStaffAttendantWhere } from "@/lib/staffUsers";

type AttendantRow = {
  id: string;
  name: string | null;
  email: string | null;
  attendantCategory: string | null;
  isActive: boolean;
  createdAt: Date;
};

export default async function AdminAttendantsPage() {
  let attendantsRaw: AttendantRow[] = [];
  try {
    attendantsRaw = await prisma.user.findMany({
      where: buildStaffAttendantWhere(),
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
  } catch (err) {
    // Log full error server-side so host logs capture stack and details.
    console.error("AdminAttendantsPage: failed to query attendants:", err);

    if (process.env.NODE_ENV !== "production") {
      // In development/staging show the error to aid debugging
      return (
        <div className="p-6">
          <h2 className="text-lg font-semibold text-rose-400">Failed to load attendants (dev)</h2>
          <pre className="mt-2 text-xs text-slate-200 whitespace-pre-wrap">{String(err)}</pre>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100">
        <h2 className="text-lg font-semibold">Unable to load attendants</h2>
        <p className="mt-2 text-sm">
          The attendants table could not be queried. Check database connectivity and migrations, then retry.
        </p>
      </div>
    );
  }

  const prepared = attendantsRaw.map((a) => ({
    id: a.id,
    name: a.name ?? "-",
    email: a.email ?? "",
    attendantCategory: a.attendantCategory ?? null,
    isActive: a.isActive ?? true,
    createdAt: a.createdAt.toISOString(),
    categoryLabel: getCategoryLabel(a.attendantCategory),
  }));

  return <AttendantsClient attendants={prepared} />;
}
