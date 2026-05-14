import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUniqueReferralCode } from "@/lib/agents/service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const firstName = String(body?.firstName || "").trim();
    const lastName = String(body?.lastName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const phone = String(body?.phone || "").trim();
    const password = String(body?.password || "");
    const country = String(body?.country || "").trim() || null;
    const county = String(body?.county || "").trim() || null;
    const city = String(body?.city || "").trim() || null;
    const referredBy = String(body?.referralCode || "").trim() || null;

    if (!firstName || !lastName || !email || !phone || password.length < 8) {
      return NextResponse.json({ error: "First name, last name, email, phone, and a password of at least 8 characters are required." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const referralCode = await generateUniqueReferralCode();

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: `${firstName} ${lastName}`.trim(),
          password: passwordHash,
          role: "ATTENDANT",
          isActive: true,
        },
      });

      const profile = await tx.agentProfile.create({
        data: {
          userId: user.id,
          referralCode,
          firstName,
          lastName,
          email,
          phone,
          country,
          county,
          city,
          status: "pending",
        },
      });

      await tx.agentActivityLog.create({
        data: {
          agentId: user.id,
          action: "registered",
          description: referredBy ? `Self-registered with referral code ${referredBy}` : "Self-registered",
        },
      });

      return { user, profile };
    });

    return NextResponse.json({
      ok: true,
      userId: created.user.id,
      referralCode: created.profile.referralCode,
      status: created.profile.status,
    });
  } catch (error: unknown) {
    console.error("/api/agents/register POST error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
