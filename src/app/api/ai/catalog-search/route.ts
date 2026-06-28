import { NextRequest, NextResponse } from "next/server";
import { searchLiveCatalog } from "@/lib/aiCatalog";
import { isAuthorizedApiRequest } from "@/lib/apiAuth";

export async function GET(request: NextRequest) {
  const auth = isAuthorizedApiRequest(request.headers);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      },
    );
  }

  const { searchParams, origin } = new URL(request.url);
  const query = String(searchParams.get("query") || searchParams.get("q") || "").trim();
  const limit = Number(searchParams.get("limit") || "8");
  const catalog = await searchLiveCatalog({ query, origin, limit });

  return NextResponse.json({
    ok: true,
    source: catalog.source,
    query: catalog.query,
    resultCount: catalog.resultCount,
    results: catalog.results,
  });
}
