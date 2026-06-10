import { prismaPrimary } from "@/lib/prismaPrimary";
import { canonicalReceiptNumber } from "@/lib/receipts/utils";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ReceiptLookupOptions = {
  receiptId: string;
  orderRef?: string | null;
  include?: Record<string, unknown>;
  select?: Record<string, unknown>;
  attemptsMs?: number[];
  loggerPrefix?: string;
  client?: typeof prismaPrimary;
};

export async function waitForReceiptById<T = any>({
  receiptId,
  orderRef,
  include,
  select,
  attemptsMs = [0, 250, 500, 1000, 1500, 2500, 4000],
  loggerPrefix = "[receipts][waitForReceiptById]",
  client = prismaPrimary,
}: ReceiptLookupOptions): Promise<T | null> {
  const canonicalOrderRef = canonicalReceiptNumber(orderRef ?? "");

  const loadById = async () => {
    if (select) {
      return client.receipt.findUnique({ where: { id: receiptId }, select }) as Promise<T | null>;
    }
    return client.receipt.findUnique({ where: { id: receiptId }, include }) as Promise<T | null>;
  };

  const loadBySerial = async () => {
    const refs = [orderRef, canonicalOrderRef].filter((value): value is string => Boolean(value));
    if (!refs.length) return null;
    const where = {
      OR: [
        { receiptNumber: { in: refs } },
        { order: { orderNumber: { in: refs } } },
      ],
    };
    if (select) {
      return client.receipt.findFirst({ where, select }) as Promise<T | null>;
    }
    return client.receipt.findFirst({ where, include }) as Promise<T | null>;
  };

  for (const delayMs of attemptsMs) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const byId = await loadById();
    if (byId) return byId;

    const bySerial = await loadBySerial();
    if (bySerial) {
      console.info(`${loggerPrefix} resolved by order reference fallback`, {
        receiptId,
        orderRef: orderRef ?? null,
      });
      return bySerial;
    }
  }

  console.warn(`${loggerPrefix} receipt still not visible after retries`, {
    receiptId,
    orderRef: orderRef ?? null,
  });
  return null;
}
