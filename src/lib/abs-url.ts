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
  // Fail-open: if host is unavailable (some SSR/edge contexts), try env fallbacks then return a relative URL.
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!host) {
    const envBase =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      null;
    if (envBase && /^(http|https):\/\//i.test(envBase)) {
      return `${envBase}${normalizedPath}`;
    }
    // As a last resort, return a relative path. Next.js fetch in Server Components supports relative URLs.
    return normalizedPath;
  }
  return `${proto}://${host}${normalizedPath}`;
}

/** Append search params only when present (avoids trailing '?') */
export function withParams(base: string, params?: Record<string, string | number | boolean | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && `${v}` !== "") usp.set(k, String(v));
  }
  return usp.toString() ? `${base}?${usp}` : base;
}
