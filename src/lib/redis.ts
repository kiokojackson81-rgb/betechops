// Lightweight Redis helper with dynamic import to avoid hard dependency when REDIS_URL is not set.
let client: any = null;
let available = false;

export async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (client) return client;
  try {
    const mod = await import('ioredis');
    const Redis = mod.default || mod;
    client = new Redis(process.env.REDIS_URL as string);
    await client.ping();
    available = true;
    return client;
  } catch (e: any) {
    // fail-open
    // eslint-disable-next-line no-console
    console.warn('Redis not available:', e?.message ?? String(e));
    client = null;
    available = false;
    return null;
  }
}

export function isRedisAvailable() {
  return available;
}
