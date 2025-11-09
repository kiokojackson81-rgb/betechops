import { prisma } from "@/lib/prisma";
import AttendantsManager from "./AttendantsManager";
import { attendantCategories } from "@/lib/attendants/categories";

export default async function AttendantsPage() {
  const attendants = await prisma.user.findMany({
    where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } },
    orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      attendantCategory: true,
      isActive: true,
      createdAt: true,
    },
  });

  const prepared = attendants.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Attendants & Categories</h1>
        <p className="text-slate-300">
          Assign each attendant to the category that matches their day-to-day work. Categories drive the attendant dashboard widgets and the admin reports
          below.
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-slate-400">
          {attendantCategories.map((cat) => (
            <span key={cat.id} className="rounded-full border border-white/10 px-3 py-1">
              <span className="font-medium text-white">{cat.label}</span>
              <span className="mx-2 text-slate-500">•</span>
              {cat.description}
            </span>
          ))}
        </div>
      </header>

      <AttendantsManager initial={prepared} />
    </div>
  );
}
