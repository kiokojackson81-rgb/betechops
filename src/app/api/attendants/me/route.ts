import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function GET(req: Request) {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // check for impersonation cookie
  try {
    const cookieStore = cookies();
    const imp = cookieStore.get("impersonation")?.value;
    if (imp) {
      const secret = process.env.NEXTAUTH_SECRET || process.env.SECRET;
      if (secret) {
        try {
          const payload = jwt.verify(imp, secret) as any;
          // verify that the cookie was issued by the same admin who is currently signed in
          // find current admin id from email
          const admin = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
          if (admin && admin.role === "ADMIN" && payload?.a === admin.id) {
            const targetId = payload?.t;
            if (targetId) {
              const user = await prisma.user.findUnique({
                where: { id: targetId },
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
              if (user) {
                const { categoryAssignments, ...rest } = user;
                return NextResponse.json({ user: { ...rest, categories: categoryAssignments.map((c) => c.category) } });
              }
            }
          }
        } catch (e) {
          // ignore invalid/expired token and fallback to normal session
        }
      }
    }
  } catch (e) {
    // ignore cookie read errors and fallback to normal session
  }

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
