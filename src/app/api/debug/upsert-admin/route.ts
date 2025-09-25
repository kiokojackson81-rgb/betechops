import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-time protected endpoint to upsert the ADMIN_EMAIL into the User table.
 * Protect with a secret header `DEBUG_ADMIN_TOKEN` whose value should match the
 * `DEBUG_ADMIN_TOKEN` environment variable in deployment. This is intended for
 * quick debug/handoff use and can be removed later.
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-debug-admin-token") || req.headers.get("debug-admin-token");
  if (!process.env.DEBUG_ADMIN_TOKEN || token !== process.env.DEBUG_ADMIN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
  if (!adminEmail) return NextResponse.json({ error: "ADMIN_EMAIL not configured" }, { status: 400 });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const up = await (prisma as any).user.upsert({
      where: { email: adminEmail },
      update: { role: "ADMIN", isActive: true },
      create: { email: adminEmail, name: "Admin", role: "ADMIN", isActive: true },
    });
    return NextResponse.json({ ok: true, user: { email: up.email, role: up.role } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
