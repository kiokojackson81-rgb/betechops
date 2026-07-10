import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createQuoteRequest,
  ensureQuoteRequestsSchema,
  listCustomerQuoteRequests,
  quoteRequestCreateSchema,
} from "@/lib/quoteRequests";
import { findSafeCustomerProfileByUserId, updateSafeCustomerProfile } from "@/lib/customerProfile";
import { normalizeKenyanPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
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

const QUOTE_SUBMISSION_WINDOW_MS = 10 * 60 * 1000;
const QUOTE_SUBMISSION_MAX_PER_WINDOW = 4;
const quoteSubmissionRequests = new Map<string, number[]>();

function getQuoteRequestIp(request: NextRequest) {
  return (
    String(request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "global")
      .split(",")[0]
      .trim() || "global"
  );
}

function allowQuoteSubmission(key: string) {
  const now = Date.now();
  const recent = (quoteSubmissionRequests.get(key) || []).filter(
    (timestamp) => timestamp > now - QUOTE_SUBMISSION_WINDOW_MS,
  );
  if (recent.length >= QUOTE_SUBMISSION_MAX_PER_WINDOW) {
    quoteSubmissionRequests.set(key, recent);
    return false;
  }
  recent.push(now);
  quoteSubmissionRequests.set(key, recent);
  return true;
}

export async function POST(request: NextRequest) {
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
    const user = session?.user as {
      id?: string | null;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    } | undefined;

    if (!user?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please sign in to submit a quotation request.",
          redirectTo: "/login/phone?callbackUrl=/request-quote",
        },
        { status: 401 },
      );
    }

    const ip = getQuoteRequestIp(request);
    if (!allowQuoteSubmission(`quote-submit:${user.id}:${ip}`)) {
      return NextResponse.json(
        { ok: false, error: "Too many quote requests. Please wait before submitting another one." },
        { status: 429 },
      );
    }

    await ensureQuoteRequestsSchema();
    const normalizedPhone = normalizeKenyanPhone(parsed.data.phone);
    const normalizedEmail = String(parsed.data.email || user.email || "").trim().toLowerCase();
    const duplicateWindowStart = new Date(Date.now() - 15 * 60 * 1000);
    const recentDuplicates = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "QuoteRequest"
      WHERE "customerUserId" = ${user.id}
        AND "projectType" = ${parsed.data.projectType}
        AND "createdAt" >= ${duplicateWindowStart}
        AND (
          COALESCE("customerPhone", '') = ${normalizedPhone || parsed.data.phone.trim()}
          OR LOWER(COALESCE("customerEmail", '')) = ${normalizedEmail}
        )
      LIMIT 1
    `;

    if (recentDuplicates.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "A similar quotation request was submitted recently. Please wait for our team to respond.",
        },
        { status: 429 },
      );
    }

    const customerProfile = await findSafeCustomerProfileByUserId(user.id);
    await updateSafeCustomerProfile(user.id, {
      name: parsed.data.name || customerProfile?.name || user.name || null,
      email: parsed.data.email?.trim() || customerProfile?.email || user.email || null,
      phone: normalizedPhone || customerProfile?.phone || user.phone || null,
      county: parsed.data.county?.trim() || customerProfile?.county || null,
      town: parsed.data.town?.trim() || customerProfile?.town || null,
      estateLandmark: parsed.data.specificLocation?.trim() || customerProfile?.estateLandmark || null,
      locationNotes: parsed.data.location?.trim() || customerProfile?.locationNotes || null,
    });

    const quote = await createQuoteRequest({
      ...parsed.data,
      customerUserId: user.id,
      status: "PENDING",
      source: "WEBSITE_REQUEST",
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
