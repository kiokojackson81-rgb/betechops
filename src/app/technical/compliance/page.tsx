import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import getLandingPage from "@/lib/getLandingPage";
import { isTechnicalTeamCategory } from "@/lib/technicalTeam";

export const dynamic = "force-dynamic";

function formatDocumentType(value: string) {
  return String(value || "OTHER")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function resolveViewer(impersonateId?: string | null) {
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
  const targetId = isAdmin && impersonateId ? impersonateId : sessionUser.id;

  const viewer = await prisma.user.findUnique({
    where: { id: targetId || undefined },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      attendantCategory: true,
      employeeDocuments: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          documentType: true,
          title: true,
          fileUrl: true,
          notes: true,
          createdAt: true,
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!viewer || !viewer.isActive) {
    redirect("/login");
  }

  if (sessionUser.role !== "ADMIN" && !isTechnicalTeamCategory(viewer.attendantCategory)) {
    redirect(getLandingPage(viewer.attendantCategory ?? null, viewer.role));
  }

  return viewer;
}

export default async function TechnicalCompliancePage({
  searchParams,
}: {
  searchParams?: Promise<{ impersonateId?: string }>;
}) {
  const params = (await searchParams) || {};
  const viewer = await resolveViewer(params.impersonateId?.trim() || null);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/8 via-white/4 to-transparent p-6 shadow-2xl shadow-black/20">
        <div className="text-xs uppercase tracking-[0.26em] text-emerald-300/80">Compliance</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Employment compliance documents</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Download and review employment records uploaded by admin, including ID copies, contracts, licences, certificates, and related staff documents.
        </p>
        <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
          {viewer.name || viewer.email || "Technical staff"} · {viewer.employeeDocuments.length} document(s)
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[#091223] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-white">Available documents</div>
            <div className="text-sm text-slate-400">Documents uploaded to your employee compliance record.</div>
          </div>
        </div>

        <div className="space-y-3">
          {viewer.employeeDocuments.length ? (
            viewer.employeeDocuments.map((document) => (
              <div key={document.id} className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                      {formatDocumentType(document.documentType)}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">{document.title}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      Uploaded {new Date(document.createdAt).toLocaleDateString("en-KE")}
                      {document.uploadedBy ? ` · by ${document.uploadedBy.name || document.uploadedBy.email}` : ""}
                    </div>
                    {document.notes ? <div className="mt-2 text-sm text-slate-300">{document.notes}</div> : null}
                  </div>
                  <div className="flex gap-3">
                    <a
                      href={document.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/5"
                    >
                      Open
                    </a>
                    <a
                      href={document.fileUrl}
                      download
                      className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95"
                    >
                      Download
                    </a>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[22px] border border-dashed border-white/10 p-6 text-sm text-slate-400">
              No compliance documents have been uploaded yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
