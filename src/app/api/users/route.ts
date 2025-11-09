import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';
import { AttendantCategory, Role } from '@prisma/client';

const categoryValues = new Set(Object.values(AttendantCategory));

export async function GET(request: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const rawRoles = (url.searchParams.get('roles') || 'ATTENDANT').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const validRoles = rawRoles
    .map((role): Role | null => (role === 'ADMIN' || role === 'SUPERVISOR' || role === 'ATTENDANT' ? (role as Role) : null))
    .filter((role): role is Role => Boolean(role));
  const defaultRoles: Role[] = ['ATTENDANT'];
  const roles: Role[] = validRoles.length ? validRoles : defaultRoles;
  const category = url.searchParams.get('category') || undefined;
  const includeInactive = url.searchParams.get('includeInactive') === 'true';

  const where = {
    role: { in: roles },
    ...(category && categoryValues.has(category as AttendantCategory) ? { attendantCategory: category as AttendantCategory } : {}),
    ...(includeInactive ? {} : { isActive: true }),
  };

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ attendantCategory: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      attendantCategory: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;

  const body = (await request.json().catch(() => ({}))) as { email?: string; name?: string; role?: Role; category?: string };
  const { email, name, role, category } = body;
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const normalizedEmail = email.toLowerCase().trim();
  const categoryValue = category && categoryValues.has(category as AttendantCategory) ? (category as AttendantCategory) : undefined;

  const up = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { name: name ?? undefined, role: role ?? undefined, isActive: true, attendantCategory: categoryValue ?? undefined },
    create: {
      email: normalizedEmail,
      name: name ?? normalizedEmail.split('@')[0],
      role: role ?? 'ATTENDANT',
      attendantCategory: categoryValue ?? 'GENERAL',
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true, user: up }, { status: 201 });
}
