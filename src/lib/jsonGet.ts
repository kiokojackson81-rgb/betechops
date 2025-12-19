export function jn(obj: any, ...keys: string[]): any {
  let current = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

export function jnum(obj: any, ...keys: string[]): number {
  const value = jn(obj, ...keys);
  if (value == null) return 0;
  const num = typeof value === "object" && typeof value.toNumber === "function" ? value.toNumber() : Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function jstr(obj: any, ...keys: string[]): string {
  const value = jn(obj, ...keys);
  if (value == null) return "";
  return String(value);
}
