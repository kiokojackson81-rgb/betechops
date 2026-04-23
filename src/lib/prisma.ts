// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { validateNotBackdatedDateInput, validateNotBackdatedWeekStart } from "@/lib/noBackdating";

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

type BackdateRule = { field: string; kind: "date" | "weekStart" };

const BACKDATE_RULES: Record<string, BackdateRule[]> = {
  AttendantActivity: [{ field: "entryDate", kind: "date" }],
  DailyReport: [{ field: "date", kind: "date" }],
  MarketingDailyEntry: [{ field: "date", kind: "date" }],
  SupportDailyEntry: [{ field: "date", kind: "date" }],
  WeeklySale: [{ field: "weekStart", kind: "weekStart" }],
  MarketplaceProfitEntry: [
    { field: "date", kind: "date" },
    { field: "weekStart", kind: "weekStart" },
  ],
};

const validateBackdateRule = (model: string, payload: Record<string, unknown>, rule: BackdateRule) => {
  const candidate = payload[rule.field];
  if (candidate === null || typeof candidate === "undefined") return;
  const label = `${model}.${rule.field}`;
  if (rule.kind === "weekStart") {
    validateNotBackdatedWeekStart(candidate as string | Date, label);
    return;
  }
  validateNotBackdatedDateInput(candidate as string | Date, label);
};

const validateBackdatingForData = (model: string | undefined, data: unknown) => {
  if (!model || !data) return;
  const rules = BACKDATE_RULES[model];
  if (!rules?.length) return;
  const rows = Array.isArray(data) ? data : [data];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    for (const rule of rules) {
      validateBackdateRule(model, row as Record<string, unknown>, rule);
    }
  }
};

// Attach middleware once
const retryMiddlewareAttached = (globalThis as any).__prismaRetryAttached as boolean | undefined;
if (!retryMiddlewareAttached && typeof (prisma as any)?.$use === 'function') {
  (prisma as any).$use(async (params: any, next: any) => {
    if (params?.action === "create" || params?.action === "createMany" || params?.action === "update" || params?.action === "updateMany") {
      validateBackdatingForData(params?.model, params?.args?.data);
    }
    if (params?.action === "upsert") {
      validateBackdatingForData(params?.model, params?.args?.create);
      validateBackdatingForData(params?.model, params?.args?.update);
    }

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
