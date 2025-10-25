import { NextResponse } from 'next/server';
import { jumiaFetch } from '@/lib/jumia';

// Simple debug route to call a small Jumia endpoint using the configured refresh flow.
// Returns sanitized preview of response (no tokens or secrets).
export async function GET() {
  try {
    const j = await jumiaFetch('/catalog/products?size=5');
    // sanitize: remove any fields that look like tokens
    const preview = JSON.stringify(j, (_k, v) => {
      if (typeof v === 'string' && /token|secret|refresh/i.test(_k)) return '****';
      return v;
    });
    return NextResponse.json({ ok: true, preview: JSON.parse(preview) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
