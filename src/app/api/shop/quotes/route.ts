import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createQuoteRequest,
  listCustomerQuoteRequests,
  quoteRequestCreateSchema,
} from "@/lib/quoteRequests";
import { buildCustomerAccountIdentity } from "@/lib/shopCustomerOrders";

export async function GET() {
  try {
    const session = await auth().catch(() => null);
    const user = session?.user as { id?: string | null; phone?: string | null; email?: string | null } | undefined;

    if (!user?.id) {
      return NextResponse.json({ ok: true, quotes: [] });
    }

    const identity = buildCustomerAccountIdentity(
      {
        id: user.id,
        phone: user.phone || null,
        email: user.email || null,
      },
      null,
    );

    const quotes = await listCustomerQuoteRequests({
      userId: identity.userId,
      phoneVariants: identity.phoneVariants,
      normalizedEmails: identity.normalizedEmails,
      take: 10,
    });

    return NextResponse.json({ ok: true, quotes });
  } catch (error) {
    console.error("[shop.quotes] GET failed", error);
    return NextResponse.json({ ok: false, error: "Unable to load quote requests right now." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = quoteRequestCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid quote payload.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const session = await auth().catch(() => null);
    const user = session?.user as { id?: string | null } | undefined;
    const quote = await createQuoteRequest({
      ...parsed.data,
      customerUserId: user?.id || null,
    });

    if (!quote) {
      return NextResponse.json(
        { ok: false, error: "Unable to create quotation request right now." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      quoteRef: quote.quoteRef,
      quote,
    });
  } catch (error) {
    console.error("[shop.quotes] POST failed", error);
    return NextResponse.json(
      { ok: false, error: "Unable to submit your quotation request right now." },
      { status: 500 },
    );
  }
}
