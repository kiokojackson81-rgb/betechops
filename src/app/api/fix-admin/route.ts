import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const email = "kiokojackson81@gmail.com";
  await prisma.user.updateMany({
    where: { email },
    data: { role: "ADMIN" },
  });
  return NextResponse.json({ fixed: true, email, role: "ADMIN" });
}
