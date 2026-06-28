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
            "Search the live Betech website catalog before answering product price, stock, availability, warranty, specs, or recommendation questions.",
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

    return jsonRpc(id, {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            catalog_result: {
              source: catalog.source,
              query: catalog.query,
              resultCount: catalog.resultCount,
              results: catalog.results,
            },
          }),
        },
      ],
      structuredContent: {
        catalog_result: {
          source: catalog.source,
          query: catalog.query,
          resultCount: catalog.resultCount,
          results: catalog.results,
        },
      },
      isError: false,
    });
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`, 404);
}
