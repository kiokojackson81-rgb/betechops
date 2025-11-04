import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { noStoreJson, requireRole } from "@/lib/api";

type InMapping = { providerId: string; label?: string; names: string[] };
type OutResult = { name: string; shopId?: string; resolvedName?: string; providerId: string; label?: string; status: "updated" | "not-found" };

export const dynamic = "force-dynamic";

// POST /api/settings/jumia/shipping-defaults/by-name
// Body: { mappings: Array<{ providerId: string; label?: string; names: string[] }> }
// Resolves shop names (JUMIA only) to ids (exact match first, then contains) and persists defaults under key 'jumia:shipper-defaults'
export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN");
  if (!auth.ok) return auth.res;

  let body: { mappings?: InMapping[] } = {};
  try {
    body = (await req.json()) as { mappings?: InMapping[] };
  } catch {
    return noStoreJson({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const mappings = Array.isArray(body?.mappings) ? body.mappings : [];
  if (!mappings.length) {
    return noStoreJson({ ok: false, error: "mappings[] is required" }, { status: 400 });
  }

  // Load current defaults (if any)
  const row = await prisma.config.findUnique({ where: { key: "jumia:shipper-defaults" } }).catch(() => null);
  const defaults = ((row?.json as any) || {}) as Record<string, { providerId: string; label?: string }>;

  const results: OutResult[] = [];

  for (const map of mappings) {
    const names = Array.isArray(map.names) ? map.names : [];
    for (const nameRaw of names) {
      const name = String(nameRaw || "").trim();
      if (!name) continue;
      // Try exact (case-insensitive) first
      let shop = await prisma.shop.findFirst({ where: { platform: "JUMIA", name: { equals: name, mode: "insensitive" } }, select: { id: true, name: true } });
      if (!shop) {
        const matches = await prisma.shop.findMany({ where: { platform: "JUMIA", name: { contains: name, mode: "insensitive" } }, select: { id: true, name: true } });
        if (matches.length === 1) shop = matches[0];
        else if (matches.length > 1) {
          shop = matches.find((m) => m.name.toLowerCase() === name.toLowerCase()) || matches[0];
        }
      }
      if (!shop) {
        results.push({ name, providerId: map.providerId, label: map.label, status: "not-found" });
        continue;
      }
      defaults[shop.id] = { providerId: map.providerId, label: map.label };
      results.push({ name, shopId: shop.id, resolvedName: shop.name, providerId: map.providerId, label: map.label, status: "updated" });
    }
  }

  await prisma.config.upsert({ where: { key: "jumia:shipper-defaults" }, update: { json: defaults }, create: { key: "jumia:shipper-defaults", json: defaults } });

  return noStoreJson({ ok: true, saved: Object.keys(defaults).length, results });
}
