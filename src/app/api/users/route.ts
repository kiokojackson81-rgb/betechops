import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api';
import type { Role } from '@prisma/client';

export async function POST(request: Request) {
  const auth = await requireRole('ADMIN');
  if (!auth.ok) return auth.res;

  const body = (await request.json().catch(() => ({}))) as { email?: string; name?: string; role?: Role };
  const { email, name, role } = body;
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const normalizedEmail = email.toLowerCase().trim();
  const up = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { name: name ?? undefined, role: role ?? undefined, isActive: true },
    create: { email: normalizedEmail, name: name ?? normalizedEmail.split('@')[0], role: role ?? 'ATTENDANT', isActive: true },
  });

  return NextResponse.json({ ok: true, user: up }, { status: 201 });
}
