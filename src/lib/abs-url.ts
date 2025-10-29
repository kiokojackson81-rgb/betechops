// src/lib/abs-url.ts
import { headers } from "next/headers";

/**
 * Make an absolute URL for server-side fetches.
 * Falls back to https + host, works on Vercel behind proxies.
 */
export async function absUrl(path: string): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("Cannot determine host for server-side fetch");
  return `${proto}://${host}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Append search params only when present (avoids trailing '?') */
export function withParams(base: string, params?: Record<string, string | number | boolean | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && `${v}` !== "") usp.set(k, String(v));
  }
  return usp.toString() ? `${base}?${usp}` : base;
}
