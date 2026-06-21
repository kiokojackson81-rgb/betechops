import { NextRequest, NextResponse } from "next/server";
import { applyReferralAttributionToUser, REFERRAL_COOKIE_NAME } from "@/lib/attribution";
import { getToken } from "next-auth/jwt";
import { findSafeCustomerProfileByUserId, updateSafeCustomerProfile } from "@/lib/customerProfile";
import { findOrCreateCustomerIdentityUser } from "@/lib/customerIdentity";
import { generateUniqueReferralCode } from "@/lib/agents/service";
import { prisma } from "@/lib/prisma";
import { normalizeKenyanPhone } from "@/lib/phone";
import { createDirectVerifiedAuthToken } from "@/lib/phoneOtpAuth";

export const dynamic = "force-dynamic";

function splitNameParts(name: string) {
  const segments = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!segments.length) {
    return { firstName: "", lastName: "" };
  }

  return {
    firstName: segments[0] || "",
    lastName: segments.slice(1).join(" ") || segments[0] || "",
  };
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET || process.env.SECRET || "",
    });
    const userId = typeof token?.sub === "string" ? token.sub : null;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const accountMode = String(body?.accountMode || "customer").trim().toLowerCase();
    const name = String(body?.name || "").trim();
    const emailRaw = String(body?.email || "").trim().toLowerCase();
    const normalizedPhone = normalizeKenyanPhone(String(body?.phone || "").trim());
    const whatsappRaw = String(body?.whatsappNumber || body?.phone || "").trim();
    const normalizedWhatsapp = normalizeKenyanPhone(whatsappRaw);
    const county = String(body?.county || "").trim();
    const town = String(body?.town || "").trim();
    const estateLandmark = String(body?.estateLandmark || "").trim();
    const locationNotes = String(body?.locationNotes || "").trim();
    const preferredRedirect = String(body?.callbackUrl || (accountMode === "agent" ? "/dashboard" : "/account")).trim() || "/account";

    if (!name) {
      return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
    }

    if (accountMode === "agent" && !emailRaw) {
      return NextResponse.json({ ok: false, error: "Email is required for agent accounts." }, { status: 400 });
    }

    if (accountMode === "agent" && !normalizedPhone) {
      return NextResponse.json({ ok: false, error: "Phone number is required for agent accounts." }, { status: 400 });
    }

    if (body?.phone && !normalizedPhone) {
      return NextResponse.json({ ok: false, error: "Enter a valid Kenyan phone number." }, { status: 400 });
    }

    let updated;
    let resolvedUserId = userId;
    let nextVerificationToken: string | null = null;
    const resolution = await findOrCreateCustomerIdentityUser({
      customerName: name,
      customerPhone: normalizedPhone || null,
      customerEmail: emailRaw || null,
      county: county || null,
      town: town || null,
      estateLandmark: estateLandmark || null,
      locationNotes: locationNotes || null,
      currentUserId: userId,
    });

    updated = await updateSafeCustomerProfile(resolution.user.id, {
      name,
      email: emailRaw || resolution.user.email || null,
      phone: normalizedPhone || resolution.normalizedPhone || resolution.user.phone || null,
      county: county || resolution.user.county || null,
      town: town || resolution.user.town || null,
      estateLandmark: estateLandmark || resolution.user.estateLandmark || null,
      locationNotes: locationNotes || resolution.user.locationNotes || null,
      whatsappNumber:
        normalizedWhatsapp ||
        normalizedPhone ||
        resolution.normalizedPhone ||
        resolution.user.phone ||
        null,
    });

    resolvedUserId = updated.id;

    if (resolvedUserId !== userId) {
      nextVerificationToken = createDirectVerifiedAuthToken({
        userId: resolvedUserId,
        channel: normalizedPhone ? "phone" : "email",
        identifier: normalizedPhone || emailRaw,
        redirectTo: preferredRedirect,
        requiresProfileCompletion: false,
      });
    }

    updated = (await findSafeCustomerProfileByUserId(resolvedUserId)) || updated;

    if (accountMode === "agent") {
      const { firstName, lastName } = splitNameParts(name);
      const existingAgentProfile = await prisma.agentProfile.findUnique({
        where: { userId: resolvedUserId },
        select: { id: true, referralCode: true },
      });

      if (existingAgentProfile) {
        await prisma.agentProfile.update({
          where: { userId: resolvedUserId },
          data: {
            firstName,
            lastName,
            email: emailRaw || null,
            phone: normalizedPhone || null,
            country: "Kenya",
            county: county || null,
            city: town || null,
          },
        });
      } else {
        const referralCode = await generateUniqueReferralCode();
        await prisma.$transaction(async (tx) => {
          await tx.agentProfile.create({
            data: {
              userId: resolvedUserId,
              referralCode,
              firstName,
              lastName,
              email: emailRaw,
              phone: normalizedPhone,
              country: "Kenya",
              county: county || null,
              city: town || null,
              status: "pending",
            },
          });

          await tx.agentActivityLog.create({
            data: {
              agentId: resolvedUserId,
              action: "registered",
              description: "Registered through passwordless OTP agent onboarding",
            },
          });
        });
      }
    }

    const referralCode = req.cookies.get(REFERRAL_COOKIE_NAME)?.value || "";
    if (referralCode) {
      await applyReferralAttributionToUser(resolvedUserId, referralCode);
    }

    return NextResponse.json({
      ok: true,
      user: updated,
      verificationToken: nextVerificationToken,
      resolvedUserId,
    });
  } catch (error) {
    console.error("[account.complete-profile] save failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: "We could not save your account profile right now.",
      },
      { status: 500 },
    );
  }
}
