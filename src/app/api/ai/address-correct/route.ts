import { NextResponse } from 'next/server';

function titleCase(str: string) {
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const raw: string = String(body?.rawAddress ?? '').trim();
    if (!raw) return NextResponse.json({ error: 'Missing rawAddress' }, { status: 400 });

    // Simple normalization: collapse whitespace, title case, keep numbers intact
    const collapsed = raw.replace(/\s+/g, ' ');
    const normalized = titleCase(collapsed);

    return NextResponse.json({ address: normalized });
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
