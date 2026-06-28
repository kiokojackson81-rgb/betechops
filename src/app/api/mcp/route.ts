import { NextRequest, NextResponse } from "next/server";
import { searchLiveCatalog } from "@/lib/aiCatalog";
import { isAuthorizedApiRequest } from "@/lib/apiAuth";

const TOOL_NAME = "search_catalog_product";

type JsonRpcRequest = {
  id?: string | number | null;
  jsonrpc?: string;
  method?: string;
  params?: Record<string, unknown>;
};

function buildCatalogToolPayload(catalog: Awaited<ReturnType<typeof searchLiveCatalog>>) {
  const products = Array.isArray(catalog.results) ? catalog.results : [];
  const firstProduct = products[0] ?? null;

  console.info("Received MCP response:", {
    resultCount: Number(catalog.resultCount ?? 0),
    firstProductName: firstProduct?.productName ?? null,
    firstProductPrice: firstProduct?.price ?? null,
    firstProductAvailability: firstProduct?.availability ?? null,
  });

  return {
    source: catalog.source,
    query: catalog.query,
    resultCount: Number(catalog.resultCount ?? 0),
    results: products,
    products,
    primaryProduct: firstProduct,
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
    "Check both resultCount and the products array in the tool response.",
    "If resultCount is greater than 0 OR products.length is greater than 0, never say not available, currently unavailable, or isn't showing.",
    "When search_catalog_product returns one or more products, always use the first result as the primary recommendation.",
    "Format the reply from the returned JSON instead of giving a generic confirmation.",
    "Map and use these fields from the first returned product: productName, price, availability, warranty, shortDescription, productUrl, imageUrl.",
    "For the primary product include: Product Name, Price, Availability, Warranty, one or two key features from the short description, and the product URL when available.",
    "Use this exact response structure when product data exists: Yes, we have the {productName} available. Price: {price}. Availability: {availability}. Warranty: {warranty}. Key Features: {shortDescription}. View Product: {productUrl}. Would you like delivery or shop pickup?",
    "If imageUrl exists and the client supports product cards or image responses, include the image.",
    "If resultCount is greater than 1, show the best match first and then mention up to two alternatives ordered by relevance.",
    "Never ask unnecessary clarification questions when an exact or suitable product match already exists.",
    "Only ask follow-up questions if no suitable product was found.",
    "Only say not available if both resultCount equals 0 and the products array is empty.",
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
    const catalog = await searchLiveCatalog({ query, origin, limit });
    const toolPayload = buildCatalogToolPayload(catalog);

    return jsonRpc(id, {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            catalog_result: toolPayload,
          }),
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
