import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activeLicensedProfessional } from "@/lib/professionalCommissioning";
import CertificateReviewPanel from "@/app/admin/returns/CertificateReviewPanel";

export const dynamic = "force-dynamic";

export default async function ProfessionalReviewPage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) redirect("/login");
  const { professional, active } = await activeLicensedProfessional();
  if (user.role !== "ADMIN" && (!active || professional.userId !== user.id)) redirect("/technical/projects");
  const projects = await prisma.commissioningSession.findMany({ where: { status: "AWAITING_PROFESSIONAL_REVIEW" }, orderBy: { technicianSignedAt: "asc" }, select: { id: true, receiptId: true, receipt: { select: { receiptNumber: true, order: { select: { customerName: true } } } }, technician: { select: { name: true } } } });
  return <main className="mx-auto max-w-5xl space-y-6 p-4 text-slate-100"><h1 className="text-2xl font-bold">Professional review</h1><p>Review equipment, evidence, tests and customer handover before certifying an installation.</p>{projects.length ? projects.map(project => <article key={project.id} className="rounded-2xl border border-white/15 bg-slate-900 p-4"><h2 className="font-bold">{project.receipt.receiptNumber} · {project.receipt.order?.customerName}</h2><p className="mt-1 text-sm">Installed by {project.technician?.name || "Assigned technician"}</p><CertificateReviewPanel receiptId={project.receiptId} /></article>) : <p>No installations are awaiting review.</p>}</main>;
}
