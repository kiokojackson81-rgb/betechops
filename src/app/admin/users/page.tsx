import { prisma } from "@/lib/prisma";
import UsersManager from "./UsersManager";
import { attendantCategoryDefinitions } from "@/lib/attendants/definitions";

export default async function UsersPage() {
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
      categoryAssignments: { select: { category: true } },
    },
  });

  const prepared = attendants.map(({ categoryAssignments, createdAt, ...rest }) => ({
    ...rest,
    createdAt: createdAt.toISOString(),
    categories: categoryAssignments.map((c) => c.category),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Attendants &amp; Categories</h1>
        <p className="text-slate-300">
          Assign each attendant to the categories that match their day-to-day responsibilities.
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-slate-400">
          {attendantCategoryDefinitions.map((cat) => (
            <span key={cat.id} className="rounded-full border border-white/10 px-3 py-1">
              <span className="font-medium text-white">{cat.label}</span>
              <span className="mx-2 text-slate-500">-</span>
              {cat.description}
            </span>
          ))}
        </div>
      </header>

      <UsersManager initial={prepared} />
    </div>
  );
}
