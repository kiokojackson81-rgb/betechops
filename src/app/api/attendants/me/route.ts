import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

export async function GET(req: Request) {
  const session = await auth();
  const email = (session?.user as { email?: string; role?: string } | undefined)?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // If impersonateId is provided in the query and the current session is an ADMIN,
  // return the requested attendant's profile instead of the current user.
  try {
    const url = new URL(req.url);
    const impersonateId = url.searchParams.get("impersonateId");
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (impersonateId && role === "ADMIN") {
      const user = await prisma.user.findUnique({
        where: { id: impersonateId },
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
  } catch (e) {
    // ignore and fallthrough to normal behaviour
  }

  // check for impersonation cookie
  try {
    const cookieHeader = (req.headers && (req as any).headers?.get)
      ? req.headers.get("cookie")
      : "";
    const parseCookie = (name: string, header: string | null | undefined) => {
      if (!header) return undefined;
      const pairs = header.split(";").map((s) => s.trim());
      for (const p of pairs) {
        const idx = p.indexOf("=");
        if (idx === -1) continue;
        const k = p.slice(0, idx);
        const v = p.slice(idx + 1);
        if (k === name) return decodeURIComponent(v);
      }
      return undefined;
    };
    const imp = parseCookie("impersonation", cookieHeader);
    if (imp) {
      const secret = process.env.NEXTAUTH_SECRET || process.env.SECRET;
      if (secret) {
        try {
          const payload = (jwt as any).verify(imp, secret) as any;
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
