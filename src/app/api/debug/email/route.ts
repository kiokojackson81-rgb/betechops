import { NextRequest, NextResponse } from "next/server";
import { describeEmailError, getDefaultEmailIdentity, sendGeneralCustomerNotificationEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get("to")?.trim();

  if (!to) {
    return NextResponse.json({ ok: false, error: "Missing required query parameter: to" }, { status: 400 });
  }

  try {
    const result = await sendGeneralCustomerNotificationEmail({
      to,
      subject: "Betech Solar Solutions email test",
      title: "SMTP email test",
      intro: "Hello,",
      bodyHtml:
        "<p>This is a production SMTP test from Betech Solar Solutions.</p><p>If you received this email, the BetechOps email system is correctly connected to info@betech.co.ke.</p>",
      bodyText:
        "This is a production SMTP test from Betech Solar Solutions. If you received this email, the BetechOps email system is correctly connected to info@betech.co.ke.",
      ctaLabel: "Visit Betech Solar",
      ctaUrl: "https://www.betech.co.ke",
      outro: "You can now inspect Show Original in Gmail to confirm SPF, DKIM, and DMARC alignment.",
    });

    const identity = getDefaultEmailIdentity();

    return NextResponse.json({
      ok: true,
      messageId: result.messageId,
      from: identity.from,
      to,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: describeEmailError(error),
      },
      { status: 500 },
    );
  }
}
