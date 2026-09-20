import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { findSafeCustomerProfileByUserId } from "@/lib/customerProfile";

export const dynamic = "force-dynamic";

/** Loads only the current customer's form defaults after the checkout shell is visible. */
export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || process.env.SECRET || "",
  }).catch(() => null);
  const userId = typeof token?.sub === "string" ? token.sub : null;

  if (!userId) {
    return NextResponse.json({ ok: true, signedIn: false, profile: null });
  }

  const profile = await findSafeCustomerProfileByUserId(userId).catch(() => null);
  return NextResponse.json({
    ok: true,
    signedIn: true,
    profile: profile
      ? {
          fullName: profile.name || "",
          phoneNumber: profile.phone || "",
          whatsappNumber: profile.whatsappNumber || profile.phone || "",
          email: profile.email || "",
          county: profile.county || "",
          town: profile.town || "",
          estateLandmark: profile.estateLandmark || "",
          locationNotes: profile.locationNotes || "",
        }
      : null,
  });
}
