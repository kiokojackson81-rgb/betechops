import { prisma } from './prisma';

export async function getUserShops(userId: string) {
  return prisma.shopAssignment.findMany({ where: { userId }, include: { shop: true } });
}

export async function upsertAssignments(userId: string, entries: { shopId: string; role: 'SUPERVISOR' | 'ATTENDANT' }[]) {
  return prisma.$transaction(async (tx) => {
    await tx.shopAssignment.deleteMany({ where: { userId } });
    const data = entries.map((e) => ({ ...e, userId }));
    if (data.length === 0) return [];
    return tx.shopAssignment.createMany({ data, skipDuplicates: true });
  });
}

export function can(user: { role: string }, action: string) {
  const map: Record<string, string[]> = {
    VIEW_QUEUES: ['ATTENDANT', 'SUPERVISOR', 'ADMIN'],
    PACK: ['ATTENDANT', 'SUPERVISOR', 'ADMIN'],
    RTS: ['ATTENDANT', 'SUPERVISOR', 'ADMIN'],
    CANCEL: ['SUPERVISOR', 'ADMIN'],
    ASSIGN: ['SUPERVISOR', 'ADMIN'],
  };
  return map[action]?.includes(user.role) ?? false;
}

export default { getUserShops, upsertAssignments, can };
