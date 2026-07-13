import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCustomerAccountIdentity } from "@/lib/shopCustomerOrders";
import { listCustomerSiteVisits } from "@/lib/siteVisits";

export async function GET() {
  try {
    const session = await auth().catch(() => null);
    const user = session?.user as { id?: string | null; phone?: string | null; email?: string | null } | undefined;
    if (!user?.id) {
      return NextResponse.json({ ok: true, siteVisits: [] });
    }

    const identity = buildCustomerAccountIdentity(
      {
        id: user.id,
        phone: user.phone || null,
        email: user.email || null,
      },
      null,
    );

    const siteVisits = await listCustomerSiteVisits({
      userId: identity.userId,
      phoneVariants: identity.phoneVariants,
      normalizedEmails: identity.normalizedEmails,
      take: 10,
    });

    return NextResponse.json({ ok: true, siteVisits });
  } catch (error) {
    console.error("[shop.site-visits] GET failed", error);
    return NextResponse.json({ ok: false, error: "Unable to load site visits right now." }, { status: 500 });
  }
}
