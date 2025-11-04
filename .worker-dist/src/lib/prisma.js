"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
// src/lib/prisma.ts
const client_1 = require("@prisma/client");
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        log: ["warn", "error"], // you can add "query" during debugging
    });
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.prisma;
// Lightweight retry middleware for transient connectivity issues
// Retries queries a few times on common network errors (P1001/P1002/DNS/timeouts)
const shouldRetryPrismaError = (e) => {
    const code = e?.code;
    const msg = String(e?.message || "");
    if (code === "P1001" || code === "P1002")
        return true;
    if (/Can't reach database server|getaddrinfo|ENOTFOUND|ETIMEDOUT|ECONNRESET|Connection terminated/i.test(msg))
        return true;
    return false;
};
// Attach middleware once
let retryMiddlewareAttached = globalThis.__prismaRetryAttached;
if (!retryMiddlewareAttached) {
    exports.prisma.$use(async (params, next) => {
        const delays = [200, 500, 1000];
        let lastErr;
        for (let i = 0; i < delays.length + 1; i++) {
            try {
                return await next(params);
            }
            catch (e) {
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
    globalThis.__prismaRetryAttached = true;
}
