import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';
import { auth } from '@/lib/auth';

export async function requireShopAccess(opts: { shopId: string; minRole?: 'ATTENDANT' | 'SUPERVISOR' }) {
  // Admins bypass shop checks
  const adminCheck = await requireRole(['ADMIN']);
  if (adminCheck.ok) return { ok: true as const, actor: adminCheck.session };

  // get session directly for non-admin flows
  const session = await auth();
  const email = String((session as any)?.user?.email || '').toLowerCase();
  if (!email) return { ok: false as const, res: { error: 'Unauthorized' } };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { ok: false as const, res: { error: 'Unauthorized' } };

  const assignment = (await prisma.userShop.findUnique({ where: { userId_shopId: { userId: user.id, shopId: opts.shopId } } }).catch(() => null)) as { roleAtShop?: string } | null;
  if (!assignment) return { ok: false as const, res: { error: 'Forbidden' } };

  // role hierarchy: SUPERVISOR > ATTENDANT
  const map = { ATTENDANT: 1, SUPERVISOR: 2 } as Record<string, number>;
  const have = map[(assignment.roleAtShop as string) || ''] || 0;
  const need = opts.minRole ? map[opts.minRole] : 1;
  if (have < need) return { ok: false as const, res: { error: 'Forbidden' } };

  return { ok: true as const, actorId: user.id };
}
