import { NextResponse } from "next/server";
import { absUrl } from "@/lib/abs-url";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Aggregate across ALL shops using the internal Orders API
    let total = 0;
    let token: string | null = null;
    do {
      const base = `/api/orders?status=PENDING&shopId=ALL&size=100${token ? `&nextToken=${encodeURIComponent(token)}` : ""}`;
      const url = await absUrl(base);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`orders ALL failed: ${res.status}`);
      const j: any = await res.json();
      const arr = Array.isArray(j?.orders) ? j.orders : Array.isArray(j?.items) ? j.items : Array.isArray(j?.data) ? j.data : [];
      total += arr.length;
      token = (j?.nextToken ? String(j.nextToken) : "") || null;
    } while (token);
    return NextResponse.json({ count: total });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ count: 0, error: msg }, { status: 200 });
  }
}
 