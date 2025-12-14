import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";

export async function PATCH(request: any, { params }: any) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user?.role ?? "") !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const id = params.id;
    const body = await request.json();
    const action = body?.action;
    if (!action || !["activate", "deactivate"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const isActive = action === "activate";
    const updated = await prisma.user.update({ where: { id }, data: { isActive } });
    return NextResponse.json({ id: updated.id, isActive: updated.isActive });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_request: any, { params }: any) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((session.user?.role ?? "") !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = params.id;
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
