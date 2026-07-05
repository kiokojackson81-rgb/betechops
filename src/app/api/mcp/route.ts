import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedApiRequest } from "@/lib/apiAuth";

const TOOL_NAME = "search_catalog_product";
const PRODUCTION_CATALOG_ORIGIN = "https://www.betech.co.ke";

type JsonRpcRequest = {
  id?: string | number | null;
  jsonrpc?: string;
  method?: string;
  params?: Record<string, unknown>;
};

type CatalogSearchApiResponse = {
  ok?: boolean;
  found?: boolean;
  queryType?: string;
  resultCount?: number;
  products?: Array<{
    productName?: string;
    price?: number;
    currency?: string;
    availability?: string;
    warranty?: string | null;
    shortDescription?: string | null;
    productUrl?: string;
    imageUrl?: string | null;
    category?: string;
    relevanceScore?: number;
  }>;
  primary?: {
    productName?: string;
    price?: number;
    currency?: string;
    availability?: string;
    warranty?: string | null;
    shortDescription?: string | null;
    productUrl?: string;
    imageUrl?: string | null;
  } | null;
  alternatives?: Array<Record<string, unknown>>;
  estimate?: Record<string, unknown>;
  needsSizing?: boolean;
};

async function callLiveCatalogSearchEndpoint(input: {
  query: string;
  limit: number;
  authHeader: string;
}) {
  const url = new URL("/api/ai/catalog-search", PRODUCTION_CATALOG_ORIGIN);
  url.searchParams.set("query", input.query);
  url.searchParams.set("limit", String(input.limit));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: input.authHeader ? { authorization: input.authHeader } : {},
    cache: "no-store",
  });

  const contentType = String(response.headers.get("content-type") || "");
  if (!response.ok) {
    throw new Error(`Catalog search endpoint failed with status ${response.status}`);
  }
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(`Catalog search endpoint returned non-JSON content-type: ${contentType || "unknown"}`);
  }

  return (await response.json()) as CatalogSearchApiResponse;
}

function buildCatalogToolPayload(catalog: CatalogSearchApiResponse) {
  const products = Array.isArray(catalog.products) ? catalog.products : [];
  const firstProduct = catalog.primary ?? products[0] ?? null;
  const resultCount = Math.max(Number(catalog.resultCount ?? 0), products.length, firstProduct ? 1 : 0);
  return {
    origin: "www.betech.co.ke",
    catalogSource: "production_live_catalog",
    found: Boolean(catalog.found ?? (resultCount > 0)),
    queryType: String(catalog.queryType || "single_product"),
    resultCount,
    debugQuery: "",
    debugResultCount: resultCount,
    debugFirstProduct: firstProduct?.productName ?? "",
    primary: firstProduct
      ? {
          productName: firstProduct.productName ?? "",
          price: Number(firstProduct.price ?? 0),
          currency: firstProduct.currency || "KES",
          availability: firstProduct.availability || "",
          warranty: firstProduct.warranty || "",
          shortDescription: firstProduct.shortDescription || "",
          productUrl: firstProduct.productUrl || "",
          imageUrl: firstProduct.imageUrl || "",
        }
      : null,
    alternatives: Array.isArray(catalog.alternatives) && catalog.alternatives.length
      ? catalog.alternatives.slice(0, 3)
      : products.slice(1, 4).map((product) => ({
      productName: product.productName ?? "",
      price: Number(product.price ?? 0),
      currency: product.currency || "KES",
      availability: product.availability || "",
      warranty: product.warranty || "",
      shortDescription: product.shortDescription || "",
      productUrl: product.productUrl || "",
      imageUrl: product.imageUrl || "",
    })),
    products,
    estimate: catalog.estimate ?? null,
    needsSizing: Boolean(catalog.needsSizing),
  };
}

function jsonRpc(id: JsonRpcRequest["id"], result: unknown, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result }, { status });
}

function jsonRpcError(id: JsonRpcRequest["id"], code: number, message: string, status = 400) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    },
    { status },
  );
}

function getServerPrompt() {
  return [
    "Use search_catalog_product before answering any product price, stock, availability, spec, warranty, or recommendation question.",
    "Treat the catalog tool output as the only source of truth.",
    "The tool returns compact JSON only. Never use HTML, markdown tables, or website page text as the answer.",
    "All final replies must be plain text only.",
    "If found is true or resultCount is greater than 0, never say not available, currently unavailable, or isn't showing.",
    "Use queryType to choose the reply style.",
    "For queryType single_product: use primary as the main answer. Mention productName, price, availability, warranty, productUrl, and one short plain-text features line from shortDescription if useful.",
    "If queryType is single_product and resultCount is greater than 1 for an exact product phrase, list up to 4 matching variants immediately using productName, price, and availability. Do not ask the customer to wait.",
    "When catalog_result has products, never say: let us check, allow us a moment, we'll confirm shortly, or checking exact listing.",
    "For exact product phrase matches with multiple variants, use this style: Yes, we have {product family} options available. 1. {productName} Price: KSh {price} Availability: {availability}. Continue for up to 4 options. End with: Would you like delivery or shop pickup?",
    "For queryType category_list: list available products from the products array in plain text with price and availability. Do not ask unnecessary clarification when products are already listed.",
    "For queryType need_based_recommendation: explain the estimate in plain text first using runningLoadWatts, dailyEnergyWh, and assumptions, then recommend primary. If needsSizing is true, tell the customer this requires a custom quotation and transfer to human or system_quote.",
    "If imageUrl exists and the client supports image responses, it may use it, but the text reply must remain plain text.",
    "If alternatives exist, mention up to two after the primary match.",
    "Never ask unnecessary clarification questions when an exact or suitable product match already exists.",
    "Only ask follow-up questions if no suitable product was found.",
    "Only say not available if found is false, resultCount equals 0, and products is empty.",
    "If the tool returns no results, say no matching product was found and do not invent details.",
    "Keep tag rules unchanged: ai_msg_1, ai_msg_2, ai_msg_3, not_clear, system_quote, hot_lead.",
    "Maximum AI replies: 3, then hand over to a human.",
    "Heavy quotation or system design requests must be tagged system_quote and transferred to a human.",
  ].join(" ");
}

export async function GET(request: NextRequest) {
  const auth = isAuthorizedApiRequest(request.headers);
  const { origin } = new URL(request.url);

  return NextResponse.json({
    ok: true,
    name: "betech_catalog_mcp",
    endpoint: `${origin}/api/mcp`,
    tool: TOOL_NAME,
    auth: auth.authRequired ? "Bearer" : "none",
    prompt: getServerPrompt(),
  });
}

export async function POST(request: NextRequest) {
  const auth = isAuthorizedApiRequest(request.headers);
  if (!auth.ok) {
    return jsonRpcError(null, -32001, "Unauthorized", 401);
  }

  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "Invalid JSON", 400);
  }

  const id = body.id ?? null;
  const method = String(body.method || "");
  const { origin } = new URL(request.url);

  if (method === "initialize") {
    return jsonRpc(
      id,
      {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "betech_catalog_mcp",
          version: "1.0.0",
        },
        capabilities: {
          tools: {},
        },
        instructions: getServerPrompt(),
      },
      200,
    );
  }

  if (method === "notifications/initialized") {
    return new NextResponse(null, { status: 202 });
  }

  if (method === "tools/list") {
    return jsonRpc(id, {
      tools: [
        {
          name: TOOL_NAME,
          description:
            "Search the live Betech website catalog before answering product price, stock, availability, warranty, specs, or recommendation questions. Use the first returned result as the primary match and format the customer reply from the returned JSON.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Customer search text for a product or category.",
              },
              limit: {
                type: "number",
                minimum: 1,
                maximum: 20,
                description: "Maximum number of catalog matches to return.",
              },
            },
            required: ["query"],
            additionalProperties: false,
          },
        },
      ],
    });
  }

  if (method === "tools/call") {
    const toolName = String(body.params?.name || "");
    if (toolName !== TOOL_NAME) {
      return jsonRpcError(id, -32602, `Unknown tool: ${toolName}`, 404);
    }

    const args = (body.params?.arguments || {}) as Record<string, unknown>;
    const query = String(args.query || "").trim();
    const limit = Number(args.limit || 8);
    const authHeader = String(request.headers.get("authorization") || "");
    console.info("[MCP search_catalog_product called]", `query=${query}`);
    console.info("[MCP search_catalog_product origin]", {
      requestOrigin: origin,
      catalogOrigin: PRODUCTION_CATALOG_ORIGIN,
      query,
      limit,
    });
    const catalog = await callLiveCatalogSearchEndpoint({ query, limit, authHeader });
    const toolPayload = buildCatalogToolPayload(catalog);
    toolPayload.debugQuery = query;
    toolPayload.debugResultCount = toolPayload.resultCount;
    toolPayload.debugFirstProduct = toolPayload.primary?.productName || "";
    console.info(
      "[MCP search_catalog_product called]",
      `queryType=${toolPayload.queryType}`,
      `resultCount=${toolPayload.resultCount}`,
      `origin=${toolPayload.origin}`,
      `catalogSource=${toolPayload.catalogSource}`,
      `firstProductName=${toolPayload.primary?.productName || ""}`,
      `firstProductPrice=${toolPayload.primary?.price ?? ""}`,
    );

    return jsonRpc(id, {
      content: [
        {
          type: "text",
          text: JSON.stringify(toolPayload),
        },
      ],
      structuredContent: {
        catalog_result: toolPayload,
      },
      isError: false,
    });
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`, 404);
}
