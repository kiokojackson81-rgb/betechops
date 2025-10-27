import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getJumiaAccessToken, ShopAuthSchema } from "@/lib/oidc";

// Keep this in sync with your vendor base resolver elsewhere
function resolveBaseUrl(input?: string | null) {
  return (
    input ??
    process.env.base_url ??
    process.env.BASE_URL ??
    process.env.JUMIA_API_BASE ??
    "https://vendor-api.jumia.com"
  );
}

type ConsoleBody = {
  shopId?: string;
  path: string; // e.g. "/orders"
  method?: string; // GET/POST/PUT/DELETE
  query?: Record<string, string | number | boolean>;
  json?: unknown; // optional payload
};

export async function POST(req: Request) {
  let body: ConsoleBody;
  try {
    body = (await req.json()) as ConsoleBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { shopId, path, method = "GET", query = {}, json } = body;
  if (!path?.startsWith("/")) {
    return NextResponse.json({ ok: false, error: "path must start with /" }, { status: 400 });
  }

  // Load shop credentials if provided
  let platform: "JUMIA" | "KILIMALL" | string = "JUMIA";
  let baseFromShop: string | undefined;
  let tokenMeta: { source?: "SHOP" | "ENV"; tokenUrl?: string } = {};
  try {
    let shopCreds: any = {};
    if (shopId) {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { id: true, name: true, platform: true, credentialsEncrypted: true, apiConfig: true },
      });
      if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
      platform = (shop.platform as any) || "JUMIA";
      // Normalize credentials JSON
      try {
        shopCreds = ShopAuthSchema.partial().parse((shop as any).credentialsEncrypted ?? (shop as any).apiConfig ?? {});
      } catch {
        shopCreds = {};
      }
      if (!shopCreds.platform) shopCreds.platform = platform;
      baseFromShop = shopCreds.apiBase || shopCreds.base_url;
    }

    const token = await getJumiaAccessToken({ platform, ...(shopId ? shopCreds : {}) } as any);
    // token may be string (legacy) or AccessToken with _meta
    tokenMeta = (token as any)._meta || {};
    const base = resolveBaseUrl(baseFromShop);

    // Build URL with query params
    const url = new URL(path, base);
    Object.entries(query || {}).forEach(([k, v]) => url.searchParams.set(k, String(v)));

    const resp = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${(token as any).access_token}`,
      },
      body: method.toUpperCase() === "GET" || method.toUpperCase() === "DELETE" ? undefined : JSON.stringify(json ?? {}),
      // don't cache live console calls
      cache: "no-store",
    });

    const text = await resp.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      // leave as text if not JSON
    }

    return NextResponse.json(
      {
        ok: resp.ok,
        status: resp.status,
        _meta: {
          authSource: tokenMeta.source ?? "ENV",
          platform,
          baseUrl: base,
          tokenUrl: tokenMeta.tokenUrl,
          path: url.pathname + url.search,
        },
        data,
      },
      { status: resp.ok ? 200 : resp.status }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Console call failed",
        _meta: { authSource: tokenMeta.source ?? "ENV", platform, baseUrl: baseFromShop || resolveBaseUrl(undefined) },
      },
      { status: 500 }
    );
  }
}
