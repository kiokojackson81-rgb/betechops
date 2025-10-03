import { noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const authz = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!authz.ok) return authz.res;
  const { type, uri, sha256, takenBy, takenAt, geo } = await req.json().catch(() => ({} as any));
  if (!type || !uri || !takenBy || !takenAt) return noStoreJson({ error: "type, uri, takenBy, takenAt required" }, { status: 400 });
  const ret = await (prisma as any).returnCase.findUnique({ where: { id: params.id } });
  if (!ret) return noStoreJson({ error: "Return not found" }, { status: 404 });
  const ev = await (prisma as any).returnEvidence.create({ data: { returnCaseId: params.id, type, uri, sha256: sha256 || "", takenBy, takenAt: new Date(takenAt), geo: geo || null } });
  await (prisma as any).actionLog.create({ data: { actorId: takenBy, entity: "ReturnCase", entityId: params.id, action: "EVIDENCE_ADD", before: null, after: ev } });
  return noStoreJson({ ok: true, id: params.id, evidenceId: ev.id });
}
