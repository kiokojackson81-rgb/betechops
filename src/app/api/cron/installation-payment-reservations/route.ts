import { NextResponse } from "next/server";
import { expireInstallationPaymentReservations } from "@/lib/installationPaymentReservations";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  return request.headers.get("x-vercel-cron") !== "" || Boolean(secret && (request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret));
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, cron: true, ...(await expireInstallationPaymentReservations()) }, { headers: { "Cache-Control": "no-store" } });
}
