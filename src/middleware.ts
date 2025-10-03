// Disabled duplicate middleware. Root-level middleware.ts is the single source of truth.
import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

// Empty matcher to ensure this middleware never runs. Avoid TS assertions in config to satisfy Next.js parser.
export const config = { matcher: [] };
