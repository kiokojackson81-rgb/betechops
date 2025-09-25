/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(_: Request, context: any) {
  const session = await auth();
  const role = (session?.user as unknown as { role?: string })?.role;
  if (!session || !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = (context?.params as any)?.id as string | undefined;
  const data: any = { status: "FULFILLED" };
  try {
    await prisma.order.update({ where: { id }, data });
  } catch {
    data.status = "COMPLETED";
    await prisma.order.update({ where: { id }, data });
  }

  return NextResponse.json({ ok: true });
}
