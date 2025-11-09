import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      attendantCategory: true,
      isActive: true,
      categoryAssignments: { select: { category: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { categoryAssignments, ...rest } = user;
  return NextResponse.json({ user: { ...rest, categories: categoryAssignments.map((c) => c.category) } });
}
