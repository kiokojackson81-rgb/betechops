import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateSafeCustomerProfile } from "@/lib/customerProfile";
import { prisma } from "@/lib/prisma";
import { normalizeKenyanPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const name = String(body?.name || "").trim();
    const emailRaw = String(body?.email || "").trim().toLowerCase();
    const normalizedPhone = normalizeKenyanPhone(String(body?.phone || "").trim());
    const normalizedWhatsapp = normalizeKenyanPhone(String(body?.whatsappNumber || "").trim());
    const county = String(body?.county || "").trim();
    const town = String(body?.town || "").trim();
    const estateLandmark = String(body?.estateLandmark || "").trim();
    const locationNotes = String(body?.locationNotes || "").trim();

    if (!name) {
      return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
    }

    if (emailRaw) {
      const existing = await prisma.user.findFirst({
        where: {
          email: emailRaw,
          id: { not: userId },
        },
        select: { id: true },
      });

      if (existing) {
        return NextResponse.json({ ok: false, error: "That email address is already in use." }, { status: 409 });
      }
    }

    if (body?.phone && !normalizedPhone) {
      return NextResponse.json({ ok: false, error: "Enter a valid Kenyan phone number." }, { status: 400 });
    }

    if (body?.whatsappNumber && !normalizedWhatsapp) {
      return NextResponse.json({ ok: false, error: "Enter a valid Kenyan WhatsApp number." }, { status: 400 });
    }

    if (normalizedPhone) {
      const existingPhone = await prisma.user.findFirst({
        where: {
          phone: normalizedPhone,
          id: { not: userId },
        },
        select: { id: true },
      });

      if (existingPhone) {
        return NextResponse.json({ ok: false, error: "That phone number is already in use." }, { status: 409 });
      }
    }

    const updated = await updateSafeCustomerProfile(userId, {
      name,
      email: emailRaw || null,
      phone: normalizedPhone || null,
      whatsappNumber: normalizedWhatsapp || null,
      county: county || null,
      town: town || null,
      estateLandmark: estateLandmark || null,
      locationNotes: locationNotes || null,
    });

    return NextResponse.json({ ok: true, user: updated });
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
