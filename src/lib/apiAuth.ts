export function getBearerTokenFromHeaders(headers: Headers) {
  const authHeader = String(headers.get("authorization") || "").trim();
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

export function isAuthorizedApiRequest(headers: Headers) {
  const configuredToken = String(process.env.BETECH_MCP_API_KEY || "").trim();
  if (!configuredToken) {
    return { ok: true as const, authRequired: false };
  }

  const providedToken = getBearerTokenFromHeaders(headers);
  if (providedToken && providedToken === configuredToken) {
    return { ok: true as const, authRequired: true };
  }

  return { ok: false as const, authRequired: true };
}
