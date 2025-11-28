import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "Server-side PDF export is not configured. Install and wire puppeteer (or similar) to render the trading-period summary to PDF.",
    },
    { status: 501 }
  );
}
