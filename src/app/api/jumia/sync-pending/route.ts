import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    {
      ok: false,
      error: "The broad pending-order sync has been retired. Use the administrator incremental sync instead.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST() {
  return disabled();
}

export async function GET() {
  return disabled();
}
