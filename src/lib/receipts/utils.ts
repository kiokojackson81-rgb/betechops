export function canonicalReceiptNumber(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.replace(/\s|-/g, "").toUpperCase();
}

export function businessDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function businessDayRangeNairobi(date: Date, padDays = 0) {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  const start = new Date(base);
  start.setDate(start.getDate() - padDays);
  const end = new Date(base);
  end.setDate(end.getDate() + padDays);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function buildReceiptKey(entryDate: Date, serial: unknown): string | null {
  const canonical = canonicalReceiptNumber(serial);
  if (!canonical) return null;
  return `${businessDateKey(entryDate)}:${canonical}`;
}

const locks = new Map<string, Promise<void>>();
export async function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  locks.set(key, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === next) {
      locks.delete(key);
    }
  }
}

export function parsePaymentMethod(input: unknown, PaymentMethod: any) {
  return typeof input === "string" && input.toUpperCase() === "CASH"
    ? PaymentMethod.CASH
    : PaymentMethod.MPESA;
}
