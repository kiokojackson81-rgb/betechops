import { NextResponse } from "next/server";
import { diagnoseOidc } from "@/lib/jumia";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const test = searchParams.get("test") === "true";
  const diag = await diagnoseOidc({ test });
  // shape per contract
  const payload = {
    issuer: diag.issuer,
    clientIdSet: diag.clientIdSet,
    hasClientSecret: diag.hasClientSecret,
    hasRefreshToken: diag.hasRefreshToken,
    ...(diag.test ? { test: diag.test } : {}),
  };
  return NextResponse.json(payload);
}
