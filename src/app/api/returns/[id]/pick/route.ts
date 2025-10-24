import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireShopAccess } from '@/lib/rbac/shops';

export async function POST(request: Request, { params }: any) {
  // find return case
  const id = params.id as string;
  const rc = await prisma.returnCase.findUnique({ where: { id } });
  if (!rc) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const access = await requireShopAccess({ shopId: rc.shopId, minRole: 'ATTENDANT' });
  if (!access.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { evidence?: string[] };
  const { evidence = [] } = body;

  // mark picked
  const updated = await prisma.returnCase.update({ where: { id }, data: { pickedAt: new Date(), status: 'picked_up' } });

  // store evidence rows if provided
  if (Array.isArray(evidence) && evidence.length) {
    const takenBy = (access as any).actorId || (access as any).actorId === undefined ? undefined : (access as any).actorId;
    const now = new Date();
    const actorId = (access as any).actorId as string | undefined;
    const rows = evidence.map((url: string) => ({ returnCaseId: id, type: 'photo', uri: url, sha256: '', takenBy: actorId || '', takenAt: now, geo: undefined }));
    await prisma.returnEvidence.createMany({ data: rows });
  }

  return NextResponse.json({ ok: true, updated });
}
