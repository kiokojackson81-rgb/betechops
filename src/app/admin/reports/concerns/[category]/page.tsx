import React from "react";
import { prisma } from "@/lib/prisma";
import { attendantCategoryDefinitions } from "@/lib/attendants/definitions";

export default async function CategoryConcernsPage(props: any) {
  const params = props?.params ?? {};
  const catId = params.category as any;
  const catDef = attendantCategoryDefinitions.find((c) => c.id === catId);
  if (!catDef) {
    return <div className="p-8 text-slate-200">Unknown category: {catId}</div>;
  }

  // fetch recent concerns for this category (90 days)
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const rows = await prisma.dailyReport.findMany({
    where: { date: { gte: since }, concerns: { not: null }, user: { attendantCategory: catId as any } },
    select: { concerns: true, date: true, user: { select: { name: true, email: true } }, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-4xl p-8 text-slate-100">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Concerns — {catDef.label}</h1>
        <p className="text-sm text-slate-400">Showing recent concerns (last 90 days). Total: {rows.length}</p>
      </header>

      <div className="space-y-4">
        {rows.map((r) => (
          <div key={String(r.createdAt)} className="rounded-lg border border-white/10 bg-white/3 p-4 text-slate-200">
            <div className="text-xs text-slate-400">{new Date(r.date).toLocaleDateString()} — {r.user?.name ?? r.user?.email ?? "Unknown"}</div>
            <div className="mt-2 whitespace-pre-wrap">{String(r.concerns)}</div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-slate-400">No concerns found for this category.</div>}
      </div>
    </div>
  );
}
