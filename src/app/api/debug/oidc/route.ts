import { NextResponse } from "next/server";
import { diagnoseOidc } from "@/lib/jumia";
import { getJumiaTokenInfo, getJumiaAccessToken } from '@/lib/oidc';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const test = searchParams.get("test") === "true";
  const diag = await diagnoseOidc({ test });

  const tokenInfo = getJumiaTokenInfo();
  const payload: any = {
    issuer: diag.issuer,
    clientIdSet: diag.clientIdSet,
    hasClientSecret: diag.hasClientSecret,
    hasRefreshToken: diag.hasRefreshToken,
    tokenUrl: tokenInfo.tokenUrl || null,
  };

  if (test) {
    // attempt to mint and report success/ttl, but do not return token
    try {
      const now = Date.now();
      await getJumiaAccessToken();
      const info = getJumiaTokenInfo();
      const expiresIn = info.expiresAt ? Math.max(0, Math.floor((info.expiresAt - now) / 1000)) : undefined;
      payload.mintOk = true;
      payload.expiresIn = expiresIn;
    } catch (e) {
      payload.mintOk = false;
      payload.mintError = e instanceof Error ? e.message : String(e);
    }
  }

  if (diag.test) payload.test = diag.test;
  return NextResponse.json(payload);
}
