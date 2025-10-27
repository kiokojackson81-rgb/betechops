import { NextResponse } from "next/server";
import { ShopAuthSchema } from "@/lib/oidc";
import { getJumiaAccessToken } from "@/lib/oidc";

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ShopAuthSchema.partial().parse(json ?? {});
  const token = await getJumiaAccessToken(parsed as any);
  return NextResponse.json({
    source: token._meta?.source,
    platform: token._meta?.platform ?? "JUMIA",
    tokenUrl: token._meta?.tokenUrl,
  });
}
