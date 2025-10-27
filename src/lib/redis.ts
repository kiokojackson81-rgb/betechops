// Lightweight Redis helper with dynamic import to avoid hard dependency when REDIS_URL is not set.
type PartialRedisLike = {
  ping?: () => Promise<string>;
  get: (key: string) => Promise<string | null>;
  set: (...args: unknown[]) => Promise<unknown>;
};
let client: PartialRedisLike | null = null;
let available = false;

export async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (client) return client;
  try {
    const mod = await import('ioredis');
    const Redis = mod.default || mod;
  // cast to PartialRedisLike to avoid tight dependency on ioredis types in this helper
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  client = new (Redis as any)(process.env.REDIS_URL as string) as PartialRedisLike;
  await client.ping?.();
    available = true;
    return client;
  } catch (err: unknown) {
    // fail-open
    // eslint-disable-next-line no-console
    console.warn('Redis not available:', err instanceof Error ? err.message : String(err));
    client = null;
    available = false;
    return null;
  }
}

export function isRedisAvailable() {
  return available;
}
