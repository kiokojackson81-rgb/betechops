// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"], // you can add "query" during debugging
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Lightweight retry middleware for transient connectivity issues
// Retries queries a few times on common network errors (P1001/P1002/DNS/timeouts)
const shouldRetryPrismaError = (e: unknown): boolean => {
  const code = (e as any)?.code as string | undefined;
  const msg = String((e as any)?.message || "");
  if (code === "P1001" || code === "P1002") return true;
  if (/Can't reach database server|getaddrinfo|ENOTFOUND|ETIMEDOUT|ECONNRESET|Connection terminated/i.test(msg)) return true;
  return false;
};

// Attach middleware once
let retryMiddlewareAttached = (globalThis as any).__prismaRetryAttached as boolean | undefined;
if (!retryMiddlewareAttached && typeof (prisma as any)?.$use === 'function') {
  (prisma as any).$use(async (params: any, next: any) => {
    const delays = [200, 500, 1000];
    let lastErr: unknown;
    for (let i = 0; i < delays.length + 1; i++) {
      try {
        return await next(params);
      } catch (e) {
        lastErr = e;
        if (i < delays.length && shouldRetryPrismaError(e)) {
          await new Promise((r) => setTimeout(r, delays[i]));
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  });
  (globalThis as any).__prismaRetryAttached = true;
}